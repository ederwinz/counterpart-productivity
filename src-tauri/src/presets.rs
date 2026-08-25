use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PresetDef {
    pub key: &'static str,
    pub label: &'static str,
    pub work_minutes: i64,
    pub break_minutes: i64,
    pub long_break_minutes: Option<i64>,
    pub rounds_before_long_break: Option<i64>,
    pub description: &'static str,
}

const PRESETS: &[PresetDef] = &[
    PresetDef {
        key: "pomodoro",
        label: "Pomodoro",
        work_minutes: 25,
        break_minutes: 5,
        long_break_minutes: Some(20),
        rounds_before_long_break: Some(4),
        description: "25 min focused work, 5 min break. After 4 rounds, take a longer break. Good for tasks needing frequent forced breaks, or when starting feels hard — 25 min is a low commitment barrier.",
    },
    PresetDef {
        key: "fifty_two_seventeen",
        label: "52/17",
        work_minutes: 52,
        break_minutes: 17,
        long_break_minutes: None,
        rounds_before_long_break: None,
        description: "52 min work, 17 min break. Based on a productivity study of high performers; longer stretches suit deep-focus work like reading dense material or writing, where 25 min feels too short to get into flow.",
    },
    PresetDef {
        key: "ninety_minute",
        label: "90-Minute Focus Block",
        work_minutes: 90,
        break_minutes: 15,
        long_break_minutes: None,
        rounds_before_long_break: None,
        description: "90 min work, 15-20 min break. Based on the brain's natural ~90-min cycles of alertness before a dip. Popular for deep work, coding, or exam prep sessions.",
    },
    PresetDef {
        key: "fifty_ten",
        label: "50/10",
        work_minutes: 50,
        break_minutes: 10,
        long_break_minutes: None,
        rounds_before_long_break: None,
        description: "A middle-ground version, common with students who find 25 min too choppy but 90 min too long to sustain.",
    },
    PresetDef {
        key: "sprint_10_2",
        label: "Quick Sprint (10/2)",
        work_minutes: 10,
        break_minutes: 2,
        long_break_minutes: None,
        rounds_before_long_break: None,
        description: "Short cycles for tasks needing intense focus but that are mentally exhausting fast — sometimes used for ADHD-friendly studying or when starting from very low motivation.",
    },
    PresetDef {
        key: "sprint_20_5",
        label: "Quick Sprint (20/5)",
        work_minutes: 20,
        break_minutes: 5,
        long_break_minutes: None,
        rounds_before_long_break: None,
        description: "Short cycles for tasks needing intense focus but that are mentally exhausting fast — sometimes used for ADHD-friendly studying or when starting from very low motivation.",
    },
];

pub fn all() -> Vec<PresetDef> {
    PRESETS.to_vec()
}

pub fn lookup(key: &str) -> Option<PresetDef> {
    PRESETS.iter().find(|p| p.key == key).cloned()
}
