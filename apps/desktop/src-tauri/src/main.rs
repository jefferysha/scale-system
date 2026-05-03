// 防止 Windows 上启动多余的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    scale_desktop_lib::run()
}
