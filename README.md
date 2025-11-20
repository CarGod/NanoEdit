# NanoEdit - AI 图像编辑器

NanoEdit 是一个基于 Google **Gemini 2.5 Flash** 模型构建的现代化 AI 图像编辑应用。它允许用户通过简单的画笔涂抹和文字指令，对图片进行局部重绘、风格转换，或者从零开始生成全新的图像。

![Project Screenshot](https://via.placeholder.com/1200x600?text=NanoEdit+Screenshot)

## ✨ 主要功能

*   **智能局部重绘 (Inpainting)**：上传照片，使用画笔圈选（遮罩）特定区域，通过文字指令修改该区域的内容（例如："给这个人戴上墨镜"）。
*   **文生图 (Text-to-Image)**：支持不上传图片，直接通过文字描述生成全新的图像。
*   **虚拟画布与比例控制**：
    *   提供多种常见比例选择（1:1, 16:9, 9:16, 4:3, 3:4）。
    *   自动生成对应比例的空白画布，精准控制生成结果的构图。
*   **绘图工具箱**：
    *   自由画笔、橡皮擦。
    *   矩形和圆形选框工具。
    *   支持“遮罩模式”（红底）和“绘图模式”（彩色草图）。
*   **风格预设**：内置赛博朋克、水彩、素描等多种艺术风格，一键应用。
*   **安全配置**：API Key 可通过界面配置或环境变量注入，不会硬编码在代码中。

## 🛠️ 技术栈

*   **前端框架**: [React 19](https://react.dev/)
*   **构建工具**: Vite (推荐) 或 Webpack
*   **样式库**: [Tailwind CSS](https://tailwindcss.com/)
*   **AI SDK**: [Google GenAI SDK](https://www.npmjs.com/package/@google/genai) (`@google/genai`)
*   **图标库**: [Lucide React](https://lucide.dev/)

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-username/nano-edit.git
cd nano-edit
```

### 2. 安装依赖

```bash
npm install
# 或者
yarn install
```

### 3. 配置 API Key

你需要一个 Google Gemini API Key 才能使用图像生成功能。

**方法 A：环境变量 (推荐用于开发)**
在根目录创建一个 `.env` 文件：

```env
API_KEY=your_actual_api_key_here
```

**方法 B：UI 配置**
启动应用后，点击右上角的 **设置 (Settings)** 图标，直接在界面中输入 API Key。

> 🔑 **获取 Key**: 请访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 免费申请。

### 4. 启动应用

```bash
npm start
# 或者，如果是 Vite 项目
npm run dev
```

打开浏览器访问 `http://localhost:3000` (或控制台提示的端口)。

## 📖 使用指南

1.  **上传/创建画布**：
    *   点击“上传图片”编辑现有照片。
    *   或者点击“空白画布”，选择下方的比例（如 16:9），开始全新创作。
2.  **圈选区域**：
    *   使用左上角的画笔工具，涂抹你想要修改的区域（红色遮罩）。
    *   *提示：未被涂抹的区域将保持原样。*
3.  **输入指令**：
    *   在右侧文本框输入描述（例如：“一只在太空中的猫”）。
    *   可以点击下方的风格标签快速添加修饰词。
4.  **生成**：
    *   点击“生成”按钮，等待数秒即可获得 AI 生成的结果。

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

*注意：本项目主要用于演示 Gemini 2.5 Flash Image 模型在图像编辑与生成方面的能力。*
