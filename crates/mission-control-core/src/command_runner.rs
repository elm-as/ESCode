use crate::mission_error::{MissionError, MissionResult};
use std::path::Path;
use std::process::Command;

/// Sortie capturée d'un outil externe (git, gh, netstat, pnpm…).
#[derive(Debug, Clone)]
pub struct ToolOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Invocation d'un outil externe : programme, arguments, dossier de travail optionnel.
pub struct ToolInvocation<'a> {
    pub program: &'a str,
    pub args: &'a [&'a str],
    pub working_dir: Option<&'a Path>,
}

/// Exécute un outil externe sans fenêtre console et sans invite interactive.
///
/// `GIT_TERMINAL_PROMPT=0` et `GCM_INTERACTIVE=never` empêchent git de rester bloqué
/// indéfiniment sur une demande d'identifiants quand il est lancé en arrière-plan.
pub fn run_tool(invocation: &ToolInvocation) -> MissionResult<ToolOutput> {
    let mut command = build_command(invocation.program);
    command
        .args(invocation.args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "never")
        .env("NO_COLOR", "1");

    if let Some(dir) = invocation.working_dir {
        command.current_dir(dir);
    }

    hide_console_window(&mut command);

    let output = command.output().map_err(|err| {
        MissionError::new(
            "TOOL_UNAVAILABLE",
            format!("Impossible de lancer `{}` : {err}", invocation.program),
        )
    })?;

    Ok(ToolOutput {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// Variante qui transforme un code de sortie non nul en erreur métier.
pub fn run_tool_checked(invocation: &ToolInvocation) -> MissionResult<String> {
    let output = run_tool(invocation)?;
    if output.success {
        return Ok(output.stdout);
    }
    let detail = first_meaningful_line(&output.stderr).unwrap_or("échec sans message");
    Err(MissionError::new(
        "TOOL_FAILED",
        format!("`{}` a échoué : {detail}", invocation.program),
    ))
}

fn first_meaningful_line(text: &str) -> Option<&str> {
    text.lines().map(str::trim).find(|line| !line.is_empty())
}

/// Sur Windows, les CLI installées via npm (`gh` non, mais `netlify`, `pnpm`) sont des
/// scripts `.cmd`/`.ps1` que `Command::new` ne résout pas seul : on passe par `cmd /C`.
fn build_command(program: &str) -> Command {
    if cfg!(windows) && is_script_shim(program) {
        let mut command = Command::new("cmd");
        command.args(["/D", "/C", program]);
        return command;
    }
    Command::new(program)
}

fn is_script_shim(program: &str) -> bool {
    matches!(program, "pnpm" | "npm" | "npx" | "netlify" | "flutter" | "dart")
}

#[cfg(windows)]
fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console_window(_command: &mut Command) {}

