<template>
  <div class="hosts-editor-container">
    <div class="line-numbers" ref="lineNumbers">
      <div 
        v-for="n in lineCount" 
        :key="n" 
        class="line-number"
        @click="toggleLineComment(n-1)"
      >{{ n }}</div>
    </div>
    <div class="editor-wrapper">
      <textarea
        ref="editor"
        class="hosts-editor"
        :value="value"
        @input="onInput"
        @keydown="onKeyDown"
        @scroll="syncScroll"
        :readonly="readonly"
        :placeholder="readonly ? '只读模式' : '请输入内容'"
        spellcheck="false"
        wrap="off"
      ></textarea>
      <div 
        class="highlight-layer"
        ref="highlightLayer"
        v-html="highlightedContent"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.hosts-editor-container {
  position: relative;
  height: 100%;
  display: flex;
  background-color: var(--color-background);
}

.line-numbers {
  padding: 16px 0;
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
  user-select: none;
  overflow: hidden;
}

.line-number {
  color: var(--color-text-secondary);
  text-align: right;
  padding: 0 16px;
  min-width: 40px;
  cursor: pointer;
  line-height: 20px;
  font-family: "SF Mono", "Monaco", "Menlo", "Consolas", "Ubuntu Mono", monospace;
  font-size: 14px;
  height: 20px;
}

.line-number:hover {
  color: var(--color-text);
  background-color: var(--color-hover);
}

.editor-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.hosts-editor,
.highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 16px;
  margin: 0;
  border: none;
  font-family: "SF Mono", "Monaco", "Menlo", "Consolas", "Ubuntu Mono", monospace;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0;
  white-space: pre;
  word-wrap: normal;
  tab-size: 2;
  -moz-tab-size: 2;
  box-sizing: border-box;
  overflow: auto;
}

.hosts-editor {
  background: transparent;
  color: var(--color-text);
  resize: none;
  z-index: 1;
}

.highlight-layer {
  background: transparent;
  color: var(--color-text);
  pointer-events: none;
  z-index: 2;
}

/* 语法高亮样式 */
:deep(.hosts-ip) {
  color: var(--color-accent) !important;
}

:deep(.hosts-domain) {
  color: var(--color-success) !important;
}

:deep(.hosts-comment) {
  color: var(--color-text-secondary) !important;
  font-style: italic;
}

/* 滚动条样式 */
.hosts-editor::-webkit-scrollbar,
.highlight-layer::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.hosts-editor::-webkit-scrollbar-track,
.highlight-layer::-webkit-scrollbar-track {
  background: var(--color-background);
}

.hosts-editor::-webkit-scrollbar-thumb,
.highlight-layer::-webkit-scrollbar-thumb {
  background: var(--color-hover);
  border-radius: 6px;
  border: 3px solid var(--color-background);
}

/* 选中文本样式 */
::selection {
  background-color: var(--color-selection);
  color: var(--color-text) !important;
}

/* 只读状态样式 */
.hosts-editor[readonly] {
  cursor: not-allowed;
  opacity: 0.8;
}

/* 占位符样式 */
.hosts-editor::placeholder {
  color: var(--color-text-secondary);
  font-style: italic;
}

/* 像素风格特殊样式 */
:global(.pixel) .hosts-editor,
:global(.pixel) .highlight-layer {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  line-height: 24px;
  image-rendering: pixelated;
}

/* 极简风格特殊样式 */
:global(.zen) .hosts-editor,
:global(.zen) .highlight-layer {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 错误高亮样式 */
:deep(.error) {
  text-decoration: wavy underline #ff6b6b;
  text-decoration-skip-ink: none;
  position: relative;
}

:deep(.error:hover::after) {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: #ff6b6b;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
}
</style>

<script>
import syntaxService from '@/services/syntax';

export default {
  name: 'HostsEditor',
  props: {
    value: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      lastScrollTop: 0,
      lastScrollLeft: 0
    };
  },
  computed: {
    lineCount() {
      return (this.value.match(/\n/g) || []).length + 1;
    },
    highlightedContent() {
      return this.value.split('\n').map(line => {
        // 注释行
        if (line.trim().startsWith('#')) {
          return `<span class="hosts-comment">${this.escapeHtml(line)}</span>`;
        }
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) return this.escapeHtml(line);

        let html = '';
        
        // IP 地址
        const ipMatch = parts[0].match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/);
        if (ipMatch) {
          html += `<span class="hosts-ip">${this.escapeHtml(parts[0])}</span>`;
        } else {
          html += this.escapeHtml(parts[0]);
        }

        // 域名和注释
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.startsWith('#')) {
            // 注释
            html += ` <span class="hosts-comment">${this.escapeHtml(parts.slice(i).join(' '))}</span>`;
            break;
          } else if (part.includes('.')) {
            // 域名
            html += ` <span class="hosts-domain">${this.escapeHtml(part)}</span>`;
          } else {
            html += ` ${this.escapeHtml(part)}`;
          }
        }

        return html || this.escapeHtml(line);
      }).join('\n');
    }
  },
  methods: {
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    onInput(event) {
      if (this.readonly) return;
      this.$emit('input', event.target.value);
      this.syncScroll();
    },
    onKeyDown(event) {
      if (this.readonly) {
        event.preventDefault();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        this.toggleCurrentLineComment();
      }
    },
    syncScroll() {
      const editor = this.$refs.editor;
      const highlightLayer = this.$refs.highlightLayer;
      const lineNumbers = this.$refs.lineNumbers;
      
      if (editor && highlightLayer && lineNumbers) {
        highlightLayer.scrollTop = editor.scrollTop;
        highlightLayer.scrollLeft = editor.scrollLeft;
        lineNumbers.scrollTop = editor.scrollTop;
      }
    },
    toggleCurrentLineComment() {
      if (this.readonly) return;
      
      const textarea = this.$refs.editor;
      const start = textarea.selectionStart;
      const lines = this.value.split('\n');
      const position = this.value.substr(0, start).split('\n').length - 1;
      
      lines[position] = syntaxService.toggleLineComment(lines[position]);
      const newContent = lines.join('\n');
      this.$emit('input', newContent);
    },
    toggleLineComment(lineNumber) {
      if (this.readonly) return;
      
      const lines = this.value.split('\n');
      lines[lineNumber] = syntaxService.toggleLineComment(lines[lineNumber]);
      this.$emit('input', lines.join('\n'));
    }
  }
};
</script> 