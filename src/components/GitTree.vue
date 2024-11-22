<template>
  <div class="git-tree">
    <div class="branches-header">
      <h3>环境列表</h3>
      <button class="add-branch-btn" @click="showAddBranchDialog">
        <span>+</span>
      </button>
    </div>
    <div class="branches">
      <div 
        v-for="branch in branches" 
        :key="branch.name"
        :class="['branch-item', { active: currentBranch === branch.name }]"
        @click="checkoutBranch(branch.name)"
      >
        <span class="branch-icon">&#x2387;</span>
        {{ branch.name }}
      </div>
    </div>
    <div class="commits" v-if="commits.length">
      <div 
        v-for="commit in commits" 
        :key="commit.hash"
        :class="['commit-item', { active: currentCommit === commit.hash }]"
        @click="checkoutCommit(commit.hash)"
      >
        <span class="commit-hash">{{ commit.hash.substring(0, 7) }}</span>
        <span class="commit-message">{{ commit.message }}</span>
      </div>
    </div>

    <!-- 添加分支对话框 -->
    <div class="dialog-overlay" v-if="showDialog" @click="hideAddBranchDialog">
      <div class="dialog" @click.stop>
        <h3>新增环境</h3>
        <input 
          v-model="newBranchName" 
          placeholder="请输入环境名称"
          @keyup.enter="createBranch"
        >
        <div class="dialog-buttons">
          <button @click="hideAddBranchDialog">取消</button>
          <button @click="createBranch" :disabled="!newBranchName">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import gitService from '@/services/git';

export default {
  name: 'GitTree',
  data() {
    return {
      branches: [],
      commits: [],
      currentBranch: '',
      currentCommit: '',
      showDialog: false,
      newBranchName: ''
    };
  },
  async created() {
    await this.loadBranches();
  },
  methods: {
    async loadBranches() {
      try {
        this.branches = await gitService.getBranches();
        if (this.branches.length > 0) {
          await this.checkoutBranch(this.branches[0].name);
        }
      } catch (error) {
        console.error('加载分支失败:', error);
      }
    },
    async loadCommits() {
      try {
        if (!this.currentBranch) {
          // 如果没有当前分支，加载默认分支
          const branches = await gitService.getBranches();
          if (branches.length > 0) {
            this.currentBranch = branches[0].name;
          } else {
            throw new Error('没有可用的分支');
          }
        }
        
        console.log('正在加载分支提交记录:', this.currentBranch);
        // 重新加载当前分支的提交记录
        this.commits = await gitService.getCommits(this.currentBranch);
        console.log('获取到的提交记录:', this.commits);
        
        // 如果有新的提交，自动选中最新的提交
        if (this.commits.length > 0) {
          const latestCommit = this.commits[0];
          console.log('切换到最新提交:', latestCommit.hash);
          await this.checkoutCommit(latestCommit.hash);
        }
      } catch (error) {
        console.error('加载提交记录失败:', error);
        throw error;
      }
    },
    async checkoutBranch(branchName) {
      try {
        if (!branchName) return;
        
        await gitService.checkout(branchName);
        this.currentBranch = branchName;
        this.commits = await gitService.getCommits(branchName);
        this.$emit('branch-changed', branchName);
        
        // 如果有提交记录，选中最新的提交
        if (this.commits.length > 0) {
          await this.checkoutCommit(this.commits[0].hash);
        }
      } catch (error) {
        console.error('切换分支失败:', error);
      }
    },
    async checkoutCommit(hash) {
      try {
        if (!hash) return;
        
        await gitService.checkoutCommit(hash);
        this.currentCommit = hash;
        this.$emit('commit-changed', hash);
      } catch (error) {
        console.error('切换提交失败:', error);
      }
    },
    showAddBranchDialog() {
      this.showDialog = true;
      this.newBranchName = '';
    },
    hideAddBranchDialog() {
      this.showDialog = false;
      this.newBranchName = '';
    },
    async createBranch() {
      if (!this.newBranchName) return;

      try {
        await gitService.createBranch(this.newBranchName);
        await this.loadBranches();
        this.hideAddBranchDialog();
        await this.checkoutBranch(this.newBranchName);
      } catch (error) {
        console.error('创建分支失败:', error);
        alert('创建分支失败: ' + error.message);
      }
    }
  }
};
</script>

<style scoped>
.git-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.branches {
  padding: 12px;
  border-bottom: 1px solid #333;
}

.branch-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: #ccc;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}

.branch-item:hover {
  background-color: #333;
}

.branch-item.active {
  background-color: #444;
  color: #fff;
}

.branch-icon {
  margin-right: 8px;
  font-size: 14px;
  color: #666;
}

.commits {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.commit-item {
  padding: 8px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 4px;
  color: #ccc;
  transition: all 0.2s;
}

.commit-item:hover {
  background-color: #333;
}

.commit-item.active {
  background-color: #444;
  color: #fff;
}

.commit-hash {
  font-family: monospace;
  color: #666;
  margin-right: 8px;
  font-size: 12px;
}

.commit-message {
  font-size: 13px;
}

.branches-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #333;
}

.branches-header h3 {
  color: #fff;
  font-size: 14px;
  font-weight: normal;
}

.add-branch-btn {
  background: #2d2d2d;
  border: 1px solid #444;
  color: #fff;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.add-branch-btn:hover {
  background: #444;
  border-color: #555;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #252525;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 20px;
  width: 300px;
}

.dialog h3 {
  color: #fff;
  margin-bottom: 16px;
  font-size: 16px;
}

.dialog input {
  width: 100%;
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  margin-bottom: 16px;
}

.dialog input:focus {
  outline: none;
  border-color: #666;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-buttons button {
  padding: 6px 16px;
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-buttons button:hover:not(:disabled) {
  background: #444;
  border-color: #555;
}

.dialog-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style> 