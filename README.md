# 桌面宝宝 — 桌面小宠物

一个基于朋友照片人物形象做的桌面小宠物（Electron）。

## 启动

**双击 `pet\run.bat`** 即可。宠物会出现在屏幕右上角的专属活动区域内，置顶显示、不占用任务栏。

> 说明：`run.bat` 复用了 `D:\Desktop\diary\diary-app\node_modules\electron\dist\electron.exe`（Electron 28.3.3）。
> 如果这个路径失效，在 `run.bat` 里把 `EXE` 改成你本机 electron.exe 的位置即可，或在 `pet` 目录执行 `npm install electron` 后用 `npx electron .` 启动。

## 功能

| 操作 | 效果 |
|---|---|
| **单击宠物** | 随机做一个可爱动作（跳、转圈、摇摆、弹跳、小跳、跳舞、压扁），偶尔冒出可爱气泡 |
| **按住拖动宠物** | 在活动区域内自由移动，松手后从该处继续随机散步 |
| **右键宠物** | 菜单：**形象**（Q版站立 / Q版蹲姿 / Q版喝水 / 整理头发）、**字幕管理…**、调整活动区域、更换形象、退出 |
| **字幕管理** | 打开窗口可修改、添加、删除气泡字幕（改动即时保存，宠物实时生效） |
| **调整活动区域** | 出现绿色虚线框：拖动**边框/角手柄**缩放、拖动**内部**整体移动，`Esc` 或点 `✓` 保存 |
| **更换形象** | 选择一张透明背景 PNG 作为新宠物形象（存入配置，永久生效） |

## 预设形象

程序内置 3 个从你的 AI 生成图中抠出的 Q 版形象（`pet\src\renderer\assets\sprites\`）：

| 形象 | 文件 | 说明 |
|---|---|---|
| Q版站立 | `zhanli.png` | 站立背书包，全身含脚 |
| Q版蹲姿 | `dun.png` | 蹲姿拿手机，全身含脚 |
| Q版喝水 | `heshui.png` | 坐姿捧杯，半身裙装 |
| 整理头发 | `zhengfa.png` | 站立理头发，全身含脚 |
| 挥手 | `q_zhan.png` | 站立挥手打招呼，全身含脚 |
| 趴卧卖萌 | `q_pa.png` | 趴卧托脸卖萌，卡通风 |
| 坐凳捧杯 | `q_zuo.png` | 坐凳子捧杯，含凳子和杯子 |
| 趴床 | `q_pachuang.png` | 写实风趴在绿色床上 |

右键宠物 → 形象 即可随时切换。默认形象是 Q版站立。

## 活动区域

- 默认：屏幕右上角，约占屏幕面积 **1/6**（宽 1/3 × 高 1/2）。
- 区域设置保存在 `%APPDATA%\desktop-pet\config.json`，下次启动自动恢复。

## 技术要点

- **宠物窗口**：无边框 + 透明 + 置顶 + 跳过任务栏；窗口随宠物移动。
- **随机游走**：主进程驱动，平滑步进（smoothstep），朝左走时镜像翻转，有随机停顿。
- **点击 vs 拖动**：移动超过 6 像素判定为拖动，否则为点击动作。
- **区域编辑**：自绘 8 手柄 + `setBounds()` 缩放（规避 Windows 透明窗口原生缩放不可靠）。
- **精灵图**：`pet\src\renderer\assets\sprite.png`，由 `tools\prep_sprite.py` 从 `片.png` 抠图生成。

## 重新生成精灵图

预设形象来自你的 AI 生成图（`桌面宝宝\` 下），用 rembg 抠图处理：

```bash
pip install rembg onnxruntime   # AI 抠图依赖
python pet/tools/prep_sprites.py  # 批量处理预设形象
python pet/tools/prep_sprite.py   # 处理单张源图（片.png）
```

新增形象后，在 `pet\src\main.js` 的 `SPRITES` 列表里加一项，右键菜单会自动出现。

## 开发

```bash
cd pet
node --test test/          # 运行几何模块单元测试
```
