use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Deserialize)]
struct ChatJson {
    requests: Option<Vec<ChatRequest>>,
}

#[derive(Deserialize)]
struct ChatRequest {
    #[serde(rename = "requestId")]
    request_id: String,
    response: Option<Vec<serde_json::Value>>,
}

#[derive(Deserialize)]
struct InvocationMessage {
    uris: Option<HashMap<String, UriEntry>>,
}

#[derive(Deserialize)]
struct UriEntry {
    path: String,
}

#[derive(Serialize, Clone)]
struct FoundPlan {
    #[serde(rename = "requestId")]
    request_id: String,
    #[serde(rename = "vsPath")]
    vs_path: String,
    #[serde(rename = "osPath")]
    os_path: String,
    content: Option<String>,
    error: Option<String>,
}

fn vs_path_to_os(vs_path: &str) -> String {
    let re = regex_lite::Regex::new(r"^/([a-zA-Z]):/(.+)$").unwrap();
    if let Some(caps) = re.captures(vs_path) {
        let drive = caps[1].to_uppercase();
        let rest = caps[2].replace('/', "\\");
        return format!("{}:\\{}", drive, rest);
    }
    vs_path.to_string()
}

fn find_all_plan_md_paths(chat: &ChatJson) -> Vec<FoundPlan> {
    let mut results: Vec<FoundPlan> = Vec::new();

    for request in chat.requests.iter().flatten() {
        for item in request.response.iter().flatten() {
            let kind = item.get("kind").and_then(|v| v.as_str()).unwrap_or("");
            if kind != "toolInvocationSerialized" {
                continue;
            }

            for msg_key in &["invocationMessage", "pastTenseMessage"] {
                let Some(msg_val) = item.get(msg_key) else { continue };
                let Ok(msg) = serde_json::from_value::<InvocationMessage>(msg_val.clone()) else {
                    continue
                };
                let Some(uris) = msg.uris else { continue };

                for (uri_key, uri_entry) in &uris {
                    if !uri_key.to_lowercase().ends_with("plan.md") {
                        continue;
                    }

                    let vs_path = uri_entry.path.clone();
                    if results.iter().any(|r| r.vs_path == vs_path) {
                        break;
                    }

                    let os_path = vs_path_to_os(&vs_path);
                    let (content, error) = match fs::read_to_string(&os_path) {
                        Ok(c) => (Some(c), None),
                        Err(e) => (None, Some(format!("Datei nicht gefunden: {os_path} ({e})"))),
                    };

                    results.push(FoundPlan {
                        request_id: request.request_id.clone(),
                        vs_path,
                        os_path,
                        content,
                        error,
                    });
                    break;
                }
            }
        }
    }

    results
}

#[tauri::command]
fn extract_plans(json: String) -> Result<Vec<FoundPlan>, String> {
    let chat: ChatJson =
        serde_json::from_str(&json).map_err(|e| format!("Ungültiges JSON: {e}"))?;
    let plans = find_all_plan_md_paths(&chat);
    if plans.is_empty() {
        return Err("Keine plan.md-Referenzen gefunden".to_string());
    }
    Ok(plans)
}

#[tauri::command]
fn extract_plans_from_path(path: String) -> Result<Vec<FoundPlan>, String> {
    let json = fs::read_to_string(&path).map_err(|e| format!("Datei konnte nicht gelesen werden: {e}"))?;
    let chat: ChatJson =
        serde_json::from_str(&json).map_err(|e| format!("Ungültiges JSON: {e}"))?;
    let plans = find_all_plan_md_paths(&chat);
    if plans.is_empty() {
        return Err("Keine plan.md-Referenzen gefunden".to_string());
    }
    Ok(plans)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![extract_plans, extract_plans_from_path])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Tauri-App");
}
