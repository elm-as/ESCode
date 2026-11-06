use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub id: String,
    pub pid: u32,
    pub port: Option<u16>,
    pub running: bool,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOutputPayload {
    pub process_id: String,
    pub stream: String, // "stdout" or "stderr"
    pub line: String,
}

struct ManagedChild {
    child: Child,
    info: ProcessInfo,
}

#[derive(Clone)]
pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ManagedChild>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Finds a free TCP port dynamically by binding to 127.0.0.1:0.
    pub fn allocate_free_port() -> Result<u16, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to bind to ephemeral port: {e}"))?;
        let addr = listener
            .local_addr()
            .map_err(|e| format!("Failed to read local address: {e}"))?;
        Ok(addr.port())
    }

    pub fn start_process(
        &self,
        app: AppHandle,
        id: &str,
        command_line: &str,
        working_dir: &str,
        env_vars: HashMap<String, String>,
        port: Option<u16>,
    ) -> Result<ProcessInfo, String> {
        // Stop any existing process with this ID first
        let _ = self.stop_process(id);

        let mut parts = command_line.split_whitespace();
        let program = parts.next().ok_or("Empty command string")?;
        let args: Vec<&str> = parts.collect();

        let mut cmd = Command::new(program);
        cmd.args(&args)
            .current_dir(working_dir)
            .envs(&env_vars)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn process '{command_line}': {e}"))?;

        let pid = child.id();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let info = ProcessInfo {
            id: id.to_string(),
            pid,
            port,
            running: true,
            command: command_line.to_string(),
        };

        // Pipe stdout to frontend event
        if let Some(out) = stdout {
            let app_out = app.clone();
            let proc_id = id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_out.emit(
                        "process_output",
                        ProcessOutputPayload {
                            process_id: proc_id.clone(),
                            stream: "stdout".to_string(),
                            line,
                        },
                    );
                }
            });
        }

        // Pipe stderr to frontend event
        if let Some(err) = stderr {
            let app_err = app.clone();
            let proc_id = id.to_string();
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().map_while(Result::ok) {
                    let _ = app_err.emit(
                        "process_output",
                        ProcessOutputPayload {
                            process_id: proc_id.clone(),
                            stream: "stderr".to_string(),
                            line,
                        },
                    );
                }
            });
        }

        let mut map = self.processes.lock().map_err(|e| e.to_string())?;
        map.insert(
            id.to_string(),
            ManagedChild {
                child,
                info: info.clone(),
            },
        );

        Ok(info)
    }

    pub fn stop_process(&self, id: &str) -> Result<(), String> {
        let mut map = self.processes.lock().map_err(|e| e.to_string())?;
        if let Some(mut managed) = map.remove(id) {
            kill_process_tree(managed.child.id());
            let _ = managed.child.kill();
        }
        Ok(())
    }

    pub fn stop_all(&self) {
        let mut map = match self.processes.lock() {
            Ok(m) => m,
            Err(_) => return,
        };

        for (_, mut managed) in map.drain() {
            kill_process_tree(managed.child.id());
            let _ = managed.child.kill();
        }
    }

    pub fn get_status(&self, id: &str) -> Result<Option<ProcessInfo>, String> {
        let mut map = self.processes.lock().map_err(|e| e.to_string())?;
        if let Some(managed) = map.get_mut(id) {
            match managed.child.try_wait() {
                Ok(Some(_status)) => {
                    managed.info.running = false;
                }
                Ok(None) => {
                    managed.info.running = true;
                }
                Err(_) => {
                    managed.info.running = false;
                }
            }
            return Ok(Some(managed.info.clone()));
        }
        Ok(None)
    }
}

/// Force-terminates an entire process tree cleanly on Windows/Unix
fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ephemeral_port_allocation() {
        let port1 = ProcessManager::allocate_free_port().expect("port allocation 1 failed");
        let port2 = ProcessManager::allocate_free_port().expect("port allocation 2 failed");
        assert!(port1 > 1024);
        assert!(port2 > 1024);
        assert_ne!(port1, port2);
    }
}


