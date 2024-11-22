<template>
  <collapsible-panel 
    direction="right"
    :default-size="300"
    @collapse-change="onCollapseChange"
  >
    <div class="version-panel">
      <div class="panel-header">
        <h3>版本历史</h3>
        <div class="tools">
          <button 
            class="tool-btn"
            @click="createVersion"
            title="保存当前版本"
          >
            <span class="icon">💾</span>
          </button>
          <button 
            class="tool-btn"
            @click="refreshVersions"
            title="刷新"
          >
            <span class="icon">🔄</span>
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div class="version-list">
          <div 
            v-for="version in versions"
            :key="version.id"
            :class="['version-item', { active: selectedVersion === version.id }]"
            @click="selectVersion(version)"
          >
            <div class="version-info">
              <span class="version-time">{{ formatTime(version.createdAt) }}</span>
              <span class="version-desc">{{ version.description || '无描述' }}</span>
            </div>
            <div class="version-actions">
              <button 
                class="action-btn"
                @click.stop="showDiff(version)"
                title="查看差异"
              >
                <span class="icon">📊</span>
              </button>
              <button 
                class="action-btn"
                @click.stop="rollbackVersion(version)"
                title="回滚到此版本"
              >
                <span class="icon">⏮</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 创建版本对话框 -->
      <div v-if="showCreateDialog" class="dialog-overlay" @click.self="hideCreateDialog">
        <div class="dialog">
          <h3>保存版本</h3>
          <div class="dialog-content">
            <div class="input-group">
              <label>版本描述</label>
              <input 
                v-model="versionDesc"
                class="dialog-input"
                placeholder="请输入版本描述（可选）"
              >
            </div>
            <div class="dialog-buttons">
              <button class="cancel-btn" @click="hideCreateDialog">取消</button>
              <button 
                class="confirm-btn"
                @click="saveVersion"
              >保存</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 差异对比对话框 -->
      <div v-if="showDiffDialog" class="dialog-overlay" @click.self="hideDiffDialog">
        <div class="dialog diff-dialog">
          <h3>版本差异</h3>
          <div class="dialog-content">
            <div class="diff-view" v-html="diffContent"></div>
            <div class="dialog-buttons">
              <button class="confirm-btn" @click="hideDiffDialog">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </collapsible-panel>
</template>

<script>
import versionService from '@/services/version';
import { diffLines } from 'diff';
import CollapsiblePanel from './CollapsiblePanel.vue';

export default {
  name: 'VersionPanel',
  components: {
    CollapsiblePanel
  },
  props: {
    currentContent: {
      type: String,
      required: true
    },
    spaceId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      versions: [],
      selectedVersion: null,
      showCreateDialog: false,
      showDiffDialog: false,
      versionDesc: '',
      diffContent: ''
    };
  },
  watch: {
    spaceId: {
      handler(newId) {
        if (newId) {
          this.loadVersions();
        }
      },
      immediate: true
    }
  },
  methods: {
    async loadVersions() {
      if (!this.spaceId) return;
      this.versions = await versionService.getVersions(this.spaceId);
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    async selectVersion(version) {
      this.selectedVersion = version.id;
      const content = await versionService.getVersionContent(this.spaceId, version.id);
      this.$emit('version-selected', content);
    },
    async showDiff(version) {
      try {
        const oldContent = await versionService.getVersionContent(this.spaceId, version.id);
        const diff = diffLines(oldContent, this.currentContent);
        
        this.diffContent = diff.map(part => {
          const color = part.added ? 'green' : part.removed ? 'red' : 'grey';
          const prefix = part.added ? '+' : part.removed ? '-' : ' ';
          return `<div style="color: ${color}">
            ${prefix} ${this.escapeHtml(part.value)}
          </div>`;
        }).join('');
        
        this.showDiffDialog = true;
      } catch (error) {
        console.error('加载差异失败:', error);
        alert('加载差异失败: ' + error.message);
      }
    },
    async rollbackVersion(version) {
      if (!confirm(`确定要回滚到 ${this.formatTime(version.createdAt)} 的版本吗？`)) {
        return;
      }

      try {
        await versionService.rollback(this.spaceId, version.id);
        const content = await versionService.getVersionContent(this.spaceId, version.id);
        this.$emit('version-rollback', content);
        await this.loadVersions();
      } catch (error) {
        console.error('回滚版本失败:', error);
        alert('回滚版本失败: ' + error.message);
      }
    },
    createVersion() {
      this.showCreateDialog = true;
      this.versionDesc = '';
    },
    hideCreateDialog() {
      this.showCreateDialog = false;
      this.versionDesc = '';
    },
    async saveVersion() {
      try {
        await versionService.createVersion(
          this.spaceId,
          this.currentContent,
          this.versionDesc
        );
        await this.loadVersions();
        this.hideCreateDialog();
      } catch (error) {
        console.error('保存版本失败:', error);
        alert('保存版本失败: ' + error.message);
      }
    },
    hideDiffDialog() {
      this.showDiffDialog = false;
      this.diffContent = '';
    },
    refreshVersions() {
      this.loadVersions();
    },
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    onCollapseChange(collapsed) {
      // 处理折叠状态变化
      this.$emit('collapse-change', collapsed);
    }
  }
};
</script>

<style scoped>
.version-panel {
  width: 300px;
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tools {
  display: flex;
  gap: 8px;
}

.tool-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.version-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
}

.version-item:hover {
  background: var(--color-hover);
}

.version-item.active {
  background: var(--color-selection);
}

.version-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.version-time {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.version-desc {
  font-size: 13px;
  color: var(--color-text);
}

.version-actions {
  display: none;
  margin-top: 8px;
  gap: 8px;
}

.version-item:hover .version-actions {
  display: flex;
}

.action-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  width: 400px;
  overflow: hidden;
}

.diff-dialog {
  width: 800px;
  height: 600px;
}

.dialog h3 {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  padding: 16px;
  margin: 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.dialog-content {
  padding: 16px;
}

.diff-view {
  font-family: monospace;
  white-space: pre-wrap;
  overflow-y: auto;
  max-height: 480px;
  padding: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-bottom: 16px;
}

.input-group {
  margin-bottom: 16px;
}

.input-group label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-bottom: 8px;
}

.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 14px;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-buttons button {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.confirm-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
</style> 