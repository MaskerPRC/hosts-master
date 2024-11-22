<template>
  <div 
    class="collapsible-panel"
    :class="{ 
      'collapsed': isCollapsed,
      'resizing': isResizing,
      [direction]: true 
    }"
    :style="panelStyle"
  >
    <div 
      v-if="direction === 'right'"
      class="resize-handle"
      @mousedown="startResize"
    ></div>
    <button 
      class="collapse-btn"
      @click="toggleCollapse"
      :title="isCollapsed ? '展开' : '收起'"
      :class="direction"
    >
      <span :class="collapseIconClass">{{ collapseIcon }}</span>
    </button>
    <div class="panel-content">
      <slot></slot>
    </div>
    <div 
      v-if="direction === 'bottom'"
      class="resize-handle"
      @mousedown="startResize"
    ></div>
  </div>
</template>

<script>
export default {
  name: 'CollapsiblePanel',
  props: {
    direction: {
      type: String,
      default: 'right',
      validator: value => ['right', 'bottom'].includes(value)
    },
    defaultSize: {
      type: Number,
      default: 300
    },
    minSize: {
      type: Number,
      default: 200
    },
    maxSize: {
      type: Number,
      default: 500
    }
  },
  data() {
    return {
      isCollapsed: false,
      isResizing: false,
      size: this.defaultSize
    };
  },
  computed: {
    panelStyle() {
      if (this.isCollapsed) {
        return {
          [this.direction === 'right' ? 'width' : 'height']: '40px'
        };
      }
      return {
        [this.direction === 'right' ? 'width' : 'height']: `${this.size}px`
      };
    },
    collapseIcon() {
      if (this.direction === 'right') {
        return this.isCollapsed ? '‹' : '›';
      }
      return this.isCollapsed ? '▲' : '▼';
    },
    collapseIconClass() {
      return {
        'collapse-icon': true,
        'right': this.direction === 'right',
        'bottom': this.direction === 'bottom'
      };
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      this.$emit('collapse-change', this.isCollapsed);
    },
    startResize(e) {
      this.isResizing = true;
      const startPos = this.direction === 'right' ? e.clientX : e.clientY;
      const startSize = this.size;

      const doDrag = (e) => {
        if (!this.isResizing) return;
        
        const currentPos = this.direction === 'right' ? e.clientX : e.clientY;
        const diff = this.direction === 'right' 
          ? startPos - currentPos 
          : startPos - currentPos;
        
        let newSize = startSize + diff;
        newSize = Math.max(this.minSize, Math.min(newSize, this.maxSize));
        this.size = newSize;
      };

      const stopDrag = () => {
        this.isResizing = false;
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
      };

      document.addEventListener('mousemove', doDrag);
      document.addEventListener('mouseup', stopDrag);
    }
  }
};
</script>

<style scoped>
.collapsible-panel {
  position: relative;
  background-color: var(--color-surface);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.collapsible-panel.right {
  border-left: 1px solid var(--color-border);
}

.collapsible-panel.bottom {
  border-top: 1px solid var(--color-border);
}

.collapsible-panel.resizing {
  transition: none;
}

.resize-handle {
  position: absolute;
  z-index: 10;
  transition: background-color 0.2s;
}

.right .resize-handle {
  left: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: e-resize;
}

.bottom .resize-handle {
  left: 0;
  top: -3px;
  width: 100%;
  height: 6px;
  cursor: n-resize;
}

.resize-handle:hover {
  background: var(--color-accent);
  opacity: 0.1;
}

.collapse-btn {
  position: absolute;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 5;
}

.collapse-btn.right {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  border-right: none;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.collapse-btn.bottom {
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 20px;
  border-top: none;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  top: 0;
}

.collapse-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.panel-content {
  height: 100%;
  overflow: auto;
}

.collapse-icon {
  font-size: 18px;
  line-height: 1;
}

.collapse-icon.bottom {
  transform: translateY(2px);
}
</style> 