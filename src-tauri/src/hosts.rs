use std::fs;
use std::process::Command;

const START_MARKER: &str = "# focus-app-block-start";
const END_MARKER: &str = "# focus-app-block-end";
const HOSTS_PATH: &str = "/etc/hosts";

/// True once the app has been granted (one-time) permission to edit /etc/hosts directly.
pub fn has_permission() -> bool {
    fs::OpenOptions::new()
        .write(true)
        .open(HOSTS_PATH)
        .is_ok()
}

/// Prompts once for an admin password (via macOS's native dialog) and hands
/// ownership of /etc/hosts to the current user, so future edits need no prompt.
pub fn grant_permission() -> Result<(), String> {
    let user = std::env::var("USER").map_err(|e| e.to_string())?;
    if !user.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err("Unexpected username format".to_string());
    }
    let script = format!(
        "do shell script \"chown {user} {HOSTS_PATH}\" with administrator privileges with prompt \"Counterpart needs one-time permission to block distracting websites during focus sessions.\""
    );
    let status = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Permission was not granted.".to_string())
    }
}

/// Replaces the app's managed block in /etc/hosts with entries for `domains`.
/// Passing an empty list clears the block. No-ops silently if permission hasn't been granted.
pub fn apply_block(domains: &[String]) {
    if !has_permission() {
        return;
    }
    let Ok(content) = fs::read_to_string(HOSTS_PATH) else {
        return;
    };
    let cleared = strip_block(&content);

    if domains.is_empty() {
        if cleared != content {
            let _ = fs::write(HOSTS_PATH, cleared);
        }
        return;
    }

    let mut block = String::new();
    block.push_str(START_MARKER);
    block.push('\n');
    for domain in domains {
        let d = domain.trim().trim_start_matches("www.");
        if d.is_empty() {
            continue;
        }
        block.push_str(&format!("127.0.0.1 {d}\n"));
        block.push_str(&format!("127.0.0.1 www.{d}\n"));
    }
    block.push_str(END_MARKER);
    block.push('\n');

    let mut new_content = cleared.trim_end().to_string();
    if !new_content.is_empty() {
        new_content.push('\n');
    }
    new_content.push_str(&block);
    let _ = fs::write(HOSTS_PATH, new_content);
}

pub fn clear_block() {
    apply_block(&[]);
}

fn strip_block(content: &str) -> String {
    let mut out = String::new();
    let mut skipping = false;
    for line in content.lines() {
        if line.trim() == START_MARKER {
            skipping = true;
            continue;
        }
        if line.trim() == END_MARKER {
            skipping = false;
            continue;
        }
        if skipping {
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }
    out
}
