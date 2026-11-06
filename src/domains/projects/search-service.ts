import { invoke } from "@tauri-apps/api/core";

export interface SearchResultItem {
  file_path: string;
  file_name: string;
  line_number: number;
  line_content: string;
}

export async function searchInFiles(
  dirPath: string,
  query: string
): Promise<SearchResultItem[]> {
  if (!query.trim()) return [];
  return await invoke<SearchResultItem[]>("fs_search_files", {
    path: dirPath,
    query: query.trim(),
  });
}

