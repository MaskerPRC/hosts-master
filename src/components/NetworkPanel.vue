<template>
  <collapsible-panel 
    direction="bottom"
    :default-size="250"
    @collapse-change="onCollapseChange"
  >
    <div class="network-panel">
      <div class="panel-header">
        <h3>网络检测</h3>
        <div class="tools">
          <button 
            class="tool-btn"
            @click="refreshAll"
            title="刷新所有"
          >
            <span class="icon">🔄</span>
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div class="check-list">
          <div 
            v-for="(check, index) in checks"
            :key="index"
            class="check-item"
          >
            <div class="check-info">
              <span class="check-type">{{ check.type === 'ping' ? 'PING' : check.type.toUpperCase() }}</span>
              <span class="check-target">{{ check.target }}</span>
            </div>
            <div class="check-status">
              <template v-if="check.loading">
                <span class="loading">检测中...</span>
              </template>
              <template v-else-if="check.error">
                <span class="error">{{ check.error }}</span>
              </template>
              <template v-else>
                <span :class="['status', { success: check.success }]">
                  {{ getStatusText(check) }}
                </span>
              </template>
              <button 
                class="refresh-btn"
                @click="refreshCheck(index)"
                :disabled="check.loading"
              >
                <span class="icon">🔄</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </collapsible-panel>
</template>

<script>
import CollapsiblePanel from './CollapsiblePanel.vue';
const { ipcRenderer } = window.require('electron');

export default {
  name: 'NetworkPanel',
  components: {
    CollapsiblePanel
  },
  props: {
    activeSchemes: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      checks: []
    };
  },
  watch: {
    activeSchemes: {
      handler: 'updateChecks',
      immediate: true
    }
  },
  methods: {
    async updateChecks() {
      // 清空现有检查
      this.checks = [];
      
      // 从激活的方案中提取所有域名
      for (const scheme of this.activeSchemes) {
        const domains = this.extractDomains(scheme.content);
        for (const domain of domains) {
          this.checks.push(
            { type: 'ping', target: domain, loading: true },
            { type: 'dns', target: domain, loading: true },
            { type: 'http', target: `http://${domain}`, loading: true }
          );
        }
      }

      // 开始检查
      this.refreshAll();
    },
    extractDomains(content) {
      const domains = new Set();
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.trim().startsWith('#')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            parts.slice(1).forEach(part => {
              if (!part.startsWith('#') && part.includes('.')) {
                domains.add(part);
              }
            });
          }
        }
      }
      return Array.from(domains);
    },
    async refreshCheck(index) {
      const check = this.checks[index];
      check.loading = true;
      check.error = null;
      check.success = false;
      check.result = null;

      try {
        let result;
        switch (check.type) {
          case 'ping':
            result = await ipcRenderer.invoke('network:ping', { host: check.target });
            break;
          case 'dns':
            result = await ipcRenderer.invoke('network:dns', { domain: check.target });
            break;
          case 'http':
            result = await ipcRenderer.invoke('network:http-check', { url: check.target });
            break;
        }

        check.success = result.success;
        check.result = result;
        check.error = result.error;
      } catch (error) {
        check.success = false;
        check.error = error.message;
      } finally {
        check.loading = false;
      }
    },
    async refreshAll() {
      const promises = this.checks.map((_, index) => this.refreshCheck(index));
      await Promise.all(promises);
    },
    getStatusText(check) {
      if (!check.success) return '失败';
      
      switch (check.type) {
        case 'ping':
          return `${check.result.time}ms`;
        case 'dns':
          return check.result.addresses.join(', ');
        case 'http':
          return `${check.result.statusCode}`;
        default:
          return '成功';
      }
    },
    onCollapseChange(collapsed) {
      this.$emit('collapse-change', collapsed);
    }
  }
};
</script>

<style scoped>
.network-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  margin: 0;
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
  padding: 8px;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-background);
  border-radius: 4px;
  transition: all 0.2s;
}

.check-item:hover {
  background: var(--color-hover);
}

.check-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.check-type {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  background: var(--color-surface);
  padding: 2px 6px;
  border-radius: 3px;
}

.check-target {
  color: var(--color-text);
  font-family: monospace;
}

.check-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading {
  color: var(--color-text-secondary);
  font-style: italic;
}

.error {
  color: var(--color-error);
}

.status {
  color: var(--color-error);
}

.status.success {
  color: var(--color-success);
}

.refresh-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0;
}

.check-item:hover .refresh-btn {
  opacity: 1;
}

.refresh-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  font-size: 14px;
  line-height: 1;
}
</style> 