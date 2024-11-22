<template>
  <collapsible-panel 
    direction="bottom"
    :default-size="250"
    @collapse-change="onCollapseChange"
  >
    <div class="check-panel">
      <div class="panel-header">
        <h3>网络检测</h3>
        <div class="tools">
          <button 
            class="tool-btn"
            :class="{ active: autoCheck }"
            @click="toggleAutoCheck"
            title="自动检测"
          >
            <span class="icon">🔄</span>
          </button>
          <button 
            class="tool-btn"
            @click="clearLogs"
            title="清除日志"
          >
            <span class="icon">🗑️</span>
          </button>
        </div>
      </div>
      <div class="panel-content">
        <div class="check-logs" ref="logsContainer">
          <div 
            v-for="(log, index) in logs"
            :key="index"
            :class="['log-item', log.type]"
          >
            <span class="timestamp">{{ formatTime(log.timestamp) }}</span>
            <span class="host">{{ log.host }}</span>
            <span class="message">{{ log.message }}</span>
            <span 
              v-if="log.type === 'error'"
              class="retry-btn"
              @click="retryCheck(log)"
            >重试</span>
          </div>
        </div>
      </div>
      <div class="panel-footer">
        <div class="status-bar">
          <span class="status-item">
            <span class="dot success"></span>
            正常: {{ successCount }}
          </span>
          <span class="status-item">
            <span class="dot error"></span>
            异常: {{ errorCount }}
          </span>
          <span class="status-item">
            <span class="dot warning"></span>
            延迟: {{ warningCount }}
          </span>
        </div>
      </div>
    </div>
  </collapsible-panel>
</template>

<script>
import CollapsiblePanel from './CollapsiblePanel.vue';
const { ipcRenderer } = window.require('electron');

export default {
  name: 'CheckPanel',
  components: {
    CollapsiblePanel
  },
  props: {
    activeSchemes: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      logs: [],
      autoCheck: true,
      checkInterval: null,
      hostStatus: new Map()
    };
  },
  computed: {
    successCount() {
      return this.logs.filter(log => log.type === 'success').length;
    },
    errorCount() {
      return this.logs.filter(log => log.type === 'error').length;
    },
    warningCount() {
      return this.logs.filter(log => log.type === 'warning').length;
    }
  },
  watch: {
    activeSchemes: {
      handler(newSchemes) {
        this.updateChecks(newSchemes);
      },
      deep: true
    }
  },
  methods: {
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
    toggleAutoCheck() {
      this.autoCheck = !this.autoCheck;
      if (this.autoCheck) {
        this.startAutoCheck();
      } else {
        this.stopAutoCheck();
      }
    },
    clearLogs() {
      this.logs = [];
      this.hostStatus.clear();
      this.$emit('status-updated', this.hostStatus);
    },
    async checkHost(host, scheme) {
      try {
        // DNS检查
        const dnsResult = await ipcRenderer.invoke('network:dns', { domain: host });
        if (!dnsResult.success) {
          this.addLog({
            host,
            type: 'error',
            message: `DNS解析失败: ${dnsResult.error}`,
            schemeId: scheme.id
          });
          return false;
        }

        // Ping检查
        const pingResult = await ipcRenderer.invoke('network:ping', { host });
        if (!pingResult.success) {
          this.addLog({
            host,
            type: 'error',
            message: `Ping失败: ${pingResult.error}`,
            schemeId: scheme.id
          });
          return false;
        }

        // 检查延迟
        if (pingResult.time > 200) {
          this.addLog({
            host,
            type: 'warning',
            message: `延迟较高: ${pingResult.time}ms`,
            schemeId: scheme.id
          });
        } else {
          this.addLog({
            host,
            type: 'success',
            message: `响应正常: ${pingResult.time}ms`,
            schemeId: scheme.id
          });
        }

        return true;
      } catch (error) {
        this.addLog({
          host,
          type: 'error',
          message: `检查失败: ${error.message}`,
          schemeId: scheme.id
        });
        return false;
      }
    },
    addLog(log) {
      const newLog = {
        ...log,
        timestamp: Date.now()
      };
      this.logs.unshift(newLog);
      
      // 限制日志数量
      if (this.logs.length > 100) {
        this.logs.pop();
      }

      // 更新主机状态
      this.hostStatus.set(log.host, {
        type: log.type,
        schemeId: log.schemeId
      });

      // 通知父组件状态更新
      this.$emit('status-updated', this.hostStatus);

      // 自动滚动到顶部
      this.$nextTick(() => {
        const container = this.$refs.logsContainer;
        container.scrollTop = 0;
      });
    },
    async retryCheck(log) {
      const scheme = this.activeSchemes.find(s => s.id === log.schemeId);
      if (scheme) {
        await this.checkHost(log.host, scheme);
      }
    },
    startAutoCheck() {
      this.checkInterval = setInterval(() => {
        this.updateChecks(this.activeSchemes);
      }, 5000);
    },
    stopAutoCheck() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    },
    async updateChecks(schemes) {
      if (!this.autoCheck) return;

      for (const scheme of schemes) {
        const hosts = this.extractHosts(scheme.content);
        for (const host of hosts) {
          await this.checkHost(host, scheme);
        }
      }
    },
    extractHosts(content) {
      const hosts = new Set();
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
          const domains = parts.slice(1).filter(d => !d.startsWith('#'));
          domains.forEach(domain => hosts.add(domain));
        }
      }
      return Array.from(hosts);
    },
    onCollapseChange(collapsed) {
      this.$emit('collapse-change', collapsed);
    }
  },
  mounted() {
    this.startAutoCheck();
  },
  beforeDestroy() {
    this.stopAutoCheck();
  }
};
</script>

<style scoped>
.check-panel {
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

.tool-btn.active {
  color: var(--color-accent);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.check-logs {
  display: flex;
  flex-direction: column;
}

.log-item {
  padding: 4px 8px;
  font-size: 12px;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 4px;
}

.log-item:hover {
  background: var(--color-hover);
}

.log-item.success {
  color: var(--color-success);
}

.log-item.error {
  color: var(--color-error);
}

.log-item.warning {
  color: #ff9800;
}

.timestamp {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.host {
  font-weight: 500;
  min-width: 120px;
}

.message {
  flex: 1;
}

.retry-btn {
  padding: 2px 6px;
  background: var(--color-surface);
  border: 1px solid currentColor;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.retry-btn:hover {
  background: var(--color-hover);
}

.panel-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--color-border);
}

.status-bar {
  display: flex;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.success {
  background: var(--color-success);
}

.dot.error {
  background: var(--color-error);
}

.dot.warning {
  background: #ff9800;
}

.icon {
  font-size: 14px;
  line-height: 1;
}
</style> 