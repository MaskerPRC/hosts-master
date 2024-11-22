'use strict'

const { app, BrowserWindow, protocol, ipcMain, shell, Tray, Menu, nativeImage, dialog } = require('electron');
const installExtension = require('electron-devtools-installer').default;
const { VUEJS_DEVTOOLS } = require('electron-devtools-installer');
const { createProtocol } = require('vue-cli-plugin-electron-builder/lib');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { AuthenticationClient } = require('authing-node-sdk');
const fsPromises = require('fs').promises;
const sudo = require('sudo-prompt');
const Store = require('electron-store');
const fs = require('fs/promises');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const dns = require('dns').promises;
const ping = require('ping');
const http = require('http');
const https = require('https');
const { Client } = require('ssh2');
const os = require('os');

let win;
let tray;
let authenticationClient;

const isDevelopment = process.env.NODE_ENV !== 'production'

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } }
])
let apiAddr = 'https://likefeeder.thinkinthink.com/api';
// apiAddr = 'http://longtest.jieshi.space'

var isQuiting = false;
async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1200,
    minHeight: 900,
    frame: false,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    await win.loadURL('app://./index.html')
  }
  require('@electron/remote/main').enable(win.webContents);

  // 创建托盘图标和菜单
  createTray();

  // 处理窗口关闭事件
  win.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  // macOS
  app.setAsDefaultProtocolClient('hostsmaster');

  // Windows
  if (process.platform === 'win32') {
    if (isDevelopment) {
      const workingDir = __dirname + "/../"; // 请替换为您的实际工作目录路径
      const appExecutable = process.execPath; // Electron 应用程序的可执行文件路径
      const batContent = `@echo off
cd /d "${workingDir}"
start /B "" "${appExecutable}" dist_electron %*
`;

      // 批处理文件的保存路径，可以放在用户数据目录中
      const batFilePath = path.join(__dirname, 'Hostsmaster.bat');

      // 创建或覆盖批处理文件
      fsPromises.writeFile(batFilePath, batContent, { encoding: 'utf-8' });
      app.setAsDefaultProtocolClient('hostsmaster', batFilePath);
    } else {
      app.setAsDefaultProtocolClient('hostsmaster');
    }
  }
  await createWindow()
})

if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

// 添加以下IPC监听器
ipcMain.on('minimize-window', () => {
  win.minimize()
})

ipcMain.on('maximize-window', () => {
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcMain.on('close-window', () => {
  win.close()
})

// 添加 Authing 配置
const AUTHING_CONFIG = {
  appId: '6725cb24c70384f03640687c',
  appHost: 'https://hostsmaster.authing.cn',
  redirectUri: 'hostsmaster://auth/callback'
}

// 处理 macOS 的深度链
app.on('open-url', async (event, url) => {
  event.preventDefault()
  await handleAuthCallback(url)
})

// 处理 Windows 的深度链接
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, argv) => {
    const url = argv.find(arg => arg.startsWith('hostsmaster://'))
    if (url) await handleAuthCallback(url)
  })
}

// 处理授权回调
async function handleAuthCallback(url) {
  const urlObj = new URL(url)
  const code = urlObj.searchParams.get('code')

  if (code) {
    try {
      const tokenResponse = await authenticationClient.getAccessTokenByCode(code);

      const { access_token } = tokenResponse

      // 获取用户信息
      const userResponse = await axios.get(
        `${AUTHING_CONFIG.appHost}/oidc/me`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`
          }
        }
      )

      // 发送登录成功消息到渲染进程
      win.webContents.send('auth:success', {
        user: userResponse.data,
        token: access_token
      })

    } catch (error) {
      win.webContents.send('auth:error', error.message)
    }
  }
}

// 添加动 Authing 登录的 IPC 处理
ipcMain.handle('auth:login', () => {
  authenticationClient = new AuthenticationClient({
    appId: AUTHING_CONFIG.appId,
    appHost: AUTHING_CONFIG.appHost,
    redirectUri: AUTHING_CONFIG.redirectUri,
    tokenEndPointAuthMethod: 'none'
  });

// 生成用于登录的一次性地址，之后可以引导用户访问此地址
  const { url } = authenticationClient.buildAuthorizeUrl();
  shell.openExternal(url)
})

// Git 相关的 IPC 处理
ipcMain.handle('git:init', async () => {
  const workDir = path.join(app.getPath('userData'), 'hosts-repo');
  try {
    await fsPromises.access(workDir);
  } catch {
    // 如果目录不存在，创建它
    await fsPromises.mkdir(workDir, { recursive: true });
  }
  return workDir;
});

// 存储分支列表
const branches = [
  { name: 'master' },
  { name: 'development' }
];

// 添加一个变量来跟踪当前分支
let currentBranch = 'master';

// 修改获取分支的处理器
ipcMain.handle('git:get-branches', async () => {
  try {
    return branches;
  } catch (error) {
    console.error('获取分支失败:', error);
    throw error;
  }
});

// 修改 checkout-branch 处理器来更新当前分支
ipcMain.handle('git:checkout-branch', async (event, branchName) => {
  try {
    console.log(`切换到分支: ${branchName}`);
    currentBranch = branchName; // 更新当前分支
    return true;
  } catch (error) {
    console.error('切换分支失败:', error);
    throw error;
  }
});

ipcMain.handle('git:checkout-commit', async (event, hash) => {
  try {
    // 实现切换到特定提交的逻辑
    console.log(`切换到提交: ${hash}`);
    return true;
  } catch (error) {
    console.error('切换提交失败:', error);
    throw error;
  }
});

// 添加一个存存储来保存提交历史
const commitsHistory = new Map(); // 用于存储每个分支的提交历史

// 修改 git:get-commits 处理器
ipcMain.handle('git:get-commits', async (event, branchName) => {
  try {
    if (!commitsHistory.has(branchName)) {
      commitsHistory.set(branchName, [
        {
          hash: '1234567',
          message: '初始提交',
          date: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
    }

    return commitsHistory.get(branchName);
  } catch (error) {
    console.error('获取提交记录失败:', error);
    throw error;
  }
});

// 将 sudo.exec 转换为 Promise 形式
const sudoExec = (command, options) => {
  return new Promise((resolve, reject) => {
    sudo.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else if (stderr) {
        reject(new Error(stderr));
      } else {
        resolve(stdout);
      }
    });
  });
};

// 存储提交内容的 Map
const commitContents = new Map();

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    return new Promise((resolve, reject) => {
      const later = async () => {
        timeout = null;
        try {
          const result = await func.apply(this, args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    });
  };
}

// 创建一个防抖版本的系统 hosts 文件写入函数
const debouncedWriteSystemHosts = debounce(async (content) => {
  const systemHostsPath = process.platform === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';

  const tempPath = path.join(app.getPath('temp'), 'hosts.tmp');

  try {
    // 确保临时文件目录存在
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    
    // 写入临时文件
    await fs.writeFile(tempPath, content, 'utf-8');
    console.log('临时文件写入成功:', tempPath);

    // Windows 系统使用 PowerShell 命令
    const command = process.platform === 'win32'
      ? `powershell -Command "Copy-Item -Path '${tempPath.replace(/\\/g, '\\\\')}' -Destination '${systemHostsPath.replace(/\\/g, '\\\\')}' -Force"`
      : `cp "${tempPath}" "${systemHostsPath}"`;

    await sudoExec(command, {
      name: 'Hosts Master'
    });
    console.log('系统 hosts 文件更新成功');

    return true;
  } catch (error) {
    console.error('写入系统 hosts 文件失败:', error);
    throw error;
  } finally {
    // 清理临时文件
    try {
      await fs.unlink(tempPath);
      console.log('临时文件清理成功');
    } catch (unlinkError) {
      console.error('清理临时文件失败:', unlinkError);
    }
  }
}, 1000); // 1秒的防抖时间

// 修改 commit 处理器
ipcMain.handle('git:commit', async (event, content) => {
  console.log('���到提交请求');
  console.log('提交内长度:', content ? content.length : 0);
  console.log('当前分支:', currentBranch);

  try {
    if (!content) {
      throw new Error('提交内容不能为空');
    }

    const workDir = path.join(app.getPath('userData'), 'hosts-repo');
    console.log('工作目录:', workDir);

    const hostsPath = path.join(workDir, 'hosts');
    console.log('hosts 文件路径:', hostsPath);

    // 写入到仓库
    console.log('正在写入仓库...');
    await fsPromises.writeFile(hostsPath, content, 'utf-8');
    console.log('仓库写入成功');

    // 生成新的提交记录
    const newCommit = {
      hash: crypto.randomBytes(20).toString('hex'),
      message: '更新 hosts 文件',
      date: new Date().toISOString()
    };

    // 保存提交内容
    commitContents.set(newCommit.hash, content);

    // 将新提交添加到当前分支的历史记录中
    const branchCommits = commitsHistory.get(currentBranch) || [];
    commitsHistory.set(currentBranch, [newCommit, ...branchCommits]);

    console.log(`分支 ${currentBranch} 的提交历史已更新:`, commitsHistory.get(currentBranch));

    // 异步更新系统 hosts 文件，不等待完成
    debouncedWriteSystemHosts(content).catch(error => {
      console.error('更新系统 hosts 文件失败:', error);
    });

    return newCommit;
  } catch (error) {
    console.error('提交更改失败:', error);
    throw error;
  }
});

// 添加获取提交内容的处理器
ipcMain.handle('git:get-commit-content', async (event, hash) => {
  console.log('获取提交内容:', hash);
  const content = commitContents.get(hash);
  if (!content) {
    // 如果是始提交，返回当前统 hosts 文件内容
    if (hash === '1234567') {
      const systemHostsPath = process.platform === 'win32'
        ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
        : '/etc/hosts';
      return await fsPromises.readFile(systemHostsPath, 'utf-8');
    }
    throw new Error('找不到提交内容');
  }
  return content;
});

// 修改 apply-commit 处理器
ipcMain.handle('git:apply-commit', async (event, hash) => {
  console.log('应用提交:', hash);
  try {
    const content = commitContents.get(hash);
    if (!content) {
      if (hash === '1234567') {
        const systemHostsPath = process.platform === 'win32'
          ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
          : '/etc/hosts';
        return await fsPromises.readFile(systemHostsPath, 'utf-8');
      }
      throw new Error('找不到提交内容');
    }

    // 使用防抖版本的写入函数
    await debouncedWriteSystemHosts(content);
    return true;
  } catch (error) {
    console.error('应用提交失败:', error);
    throw error;
  }
});

// 添加读取系统 hosts 文件的处理器
ipcMain.handle('hosts:read', async () => {
  try {
    const systemHostsPath = process.platform === 'win32'
      ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
      : '/etc/hosts';

    return await fsPromises.readFile(systemHostsPath, 'utf-8');
  } catch (error) {
    console.error('读取系统 hosts 文件失败:', error);
    throw error;
  }
});

// 修改创建分支的处理器
ipcMain.handle('git:create-branch', async (event, branchName) => {
  try {
    // 检查分支是否已存在
    if (branches.some(b => b.name === branchName)) {
      throw new Error('环境已存在');
    }

    // 创建新分支
    const newBranch = { name: branchName };

    // 初始化分支提交历史
    commitsHistory.set(branchName, [
      {
        hash: '1234567',
        message: '初始提交',
        date: new Date().toISOString()
      }
    ]);

    // 更新分支表
    branches.push(newBranch);

    return newBranch;
  } catch (error) {
    console.error('创建分支失败:', error);
    throw error;
  }
});

// 修改默认数据结构
const store = new Store({
  name: 'hosts-data',
  defaults: {
    groups: [{
      id: 'root',
      name: '根目录',
      type: 'group',
      children: [{
        id: 'default',
        name: '默认方案',
        type: 'scheme',
        content: '127.0.0.1 localhost',
        isRemote: false,
        remoteUrl: null,
        syncInterval: null,
        lastSync: null
      }]
    }],
    activeSchemes: []
  }
});

// 获取所有分组和方案
ipcMain.handle('hosts:get-all', async () => {
  const currentSpaceId = spaceStore.get('currentSpaceId');
  const spaces = spaceStore.get('spaces');
  const currentSpace = spaces.find(s => s.id === currentSpaceId);
  return currentSpace ? currentSpace.groups : [];
});

// 获取激活的方案
ipcMain.handle('hosts:get-active', async () => {
  return store.get('activeSchemes');
});

// 修改创建分组的处理器
ipcMain.handle('hosts:create-group', async (event, { parentId, name }) => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    
    if (!currentSpace) {
      throw new Error('当前工作空间不存在');
    }

    const newGroup = {
      id: crypto.randomBytes(16).toString('hex'),
      name,
      type: 'group',
      children: []
    };

    // 更新当前工作空间的分组
    const updateGroups = (items) => {
      return items.map(item => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...item.children, newGroup]
          };
        }
        if (item.type === 'group') {
          return {
            ...item,
            children: updateGroups(item.children)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(currentSpace.groups);
    currentSpace.groups = updatedGroups;

    // 保存更新后的工作空间数据
    spaceStore.set('spaces', spaces);
    // 同步更新当前 store 中的分组数据
    store.set('groups', updatedGroups);

    return newGroup;
  } catch (error) {
    console.error('创建分组失败:', error);
    throw error;
  }
});

// 修改创建方案的处理器
ipcMain.handle('hosts:create-scheme', async (event, { parentId, name, content }) => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    
    if (!currentSpace) {
      throw new Error('当前工作空间不存在');
    }

    const newScheme = {
      id: crypto.randomBytes(16).toString('hex'),
      name,
      type: 'scheme',
      content: content || ''
    };

    // 更新当前工作空间的分组
    const updateGroups = (items) => {
      return items.map(item => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...(item.children || []), newScheme]
          };
        }
        if (item.type === 'group') {
          return {
            ...item,
            children: updateGroups(item.children)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(currentSpace.groups);
    currentSpace.groups = updatedGroups;

    // 保存更新后的工作空间数据
    spaceStore.set('spaces', spaces);
    // 同步更新当前 store 中的分组数据
    store.set('groups', updatedGroups);

    return newScheme;
  } catch (error) {
    console.error('创建方案失败:', error);
    throw error;
  }
});

// 更新方案内容
ipcMain.handle('hosts:update-scheme', async (event, { id, content }) => {
  const groups = store.get('groups');
  const updateGroups = (items) => {
    return items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          content
        };
      }
      if (item.type === 'group') {
        return {
          ...item,
          children: updateGroups(item.children)
        };
      }
      return item;
    });
  };

  const updatedGroups = updateGroups(groups);
  store.set('groups', updatedGroups);
  return true;
});

// 更新激活的方案
ipcMain.handle('hosts:update-active', async (event, activeIds) => {
  store.set('activeSchemes', activeIds);

  // 合并所有激活的方案内容
  const groups = store.get('groups');
  const findScheme = (items, id) => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.type === 'group') {
        const found = findScheme(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeContents = activeIds
    .map(id => findScheme(groups, id))
    .filter(scheme => scheme)
    .map(scheme => scheme.content);

  const mergedContent = activeContents.join('\n\n');

  // 使用防抖写入系统 hosts 文件
  await debouncedWriteSystemHosts(mergedContent);

  // 通知托盘菜单更新
  ipcMain.emit('hosts:data-changed');

  return true;
});

// 修改移动项目的处理器
ipcMain.handle('hosts:move-item', async (event, { itemId, targetGroupId }) => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    
    if (!currentSpace) {
      throw new Error('当前工作空间不存在');
    }

    // 查找并移除项目
    let movedItem = null;
    const removeItem = (items) => {
      const result = [];
      for (const item of items) {
        if (item.id === itemId) {
          movedItem = { ...item };
          continue;
        }
        if (item.type === 'group') {
          const newChildren = removeItem(item.children || []);
          result.push({
            ...item,
            children: newChildren
          });
        } else {
          result.push(item);
        }
      }
      return result;
    };

    // 添加项目到目标分组
    const addItem = (items) => {
      return items.map(item => {
        if (item.id === targetGroupId) {
          return {
            ...item,
            children: [...(item.children || []), movedItem]
          };
        }
        if (item.type === 'group' && item.children) {
          return {
            ...item,
            children: addItem(item.children)
          };
        }
        return item;
      });
    };

    // 检查是否会导致循环引用
    const isDescendant = (parentId, childId) => {
      const findInChildren = (items, targetId) => {
        for (const item of items) {
          if (item.id === targetId) return true;
          if (item.type === 'group' && item.children) {
            if (findInChildren(item.children, targetId)) return true;
          }
        }
        return false;
      };

      const findItem = (items, id) => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.type === 'group' && item.children) {
            const found = findItem(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };

      const parent = findItem(currentSpace.groups, parentId);
      return parent ? findInChildren(parent.children || [], childId) : false;
    };

    // 检查是否会导致循环引用
    if (isDescendant(itemId, targetGroupId)) {
      throw new Error('不能将分组移动到其子分组中');
    }

    let updatedGroups = removeItem(currentSpace.groups);
    if (!movedItem) {
      throw new Error('找不到要移动的项目');
    }

    updatedGroups = addItem(updatedGroups);
    
    // 更新当前工作空间的分组
    currentSpace.groups = updatedGroups;
    // 保存更新后的工作空间数据
    spaceStore.set('spaces', spaces);
    // 同步更新当前 store 中的分组数据
    store.set('groups', updatedGroups);

    return {
      success: true,
      groups: updatedGroups
    };
  } catch (error) {
    console.error('移动项目失败:', error);
    throw error;
  }
});

// 添加清除数据的处理器
ipcMain.handle('hosts:clear-data', async () => {
  try {
    // 重置���初始状态
    store.set('groups', [{
      id: 'root',
      name: '根目录',
      type: 'group',
      children: []
    }]);
    store.set('activeSchemes', []);

    // 重置系统 hosts 文件为默认内容
    const defaultHosts = '127.0.0.1 localhost\n::1 localhost';
    await debouncedWriteSystemHosts(defaultHosts);

    return true;
  } catch (error) {
    console.error('清除数据失败:', error);
    throw error;
  }
});

// 添加重命名项目的处理器
ipcMain.handle('hosts:rename-item', async (event, { itemId, newName }) => {
  try {
    const groups = store.get('groups');
    
    // 更新项目名称
    const updateGroups = (items) => {
      return items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            name: newName
          };
        }
        if (item.type === 'group') {
          return {
            ...item,
            children: updateGroups(item.children)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(groups);
    store.set('groups', updatedGroups);
    
    return {
      success: true,
      groups: updatedGroups
    };
  } catch (error) {
    console.error('重命名失败:', error);
    throw error;
  }
});

// 修改删除项目的处理器
ipcMain.handle('hosts:delete-item', async (event, { itemId }) => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    
    if (!currentSpace) {
      throw new Error('当前工作空间不存在');
    }
    
    // 删除项目
    const removeItem = (items) => {
      const result = [];
      for (const item of items) {
        if (item.id === itemId) {
          // 如果是激活的方案，从激活列表中移除
          if (item.type === 'scheme') {
            const activeSchemes = currentSpace.activeSchemes;
            currentSpace.activeSchemes = activeSchemes.filter(id => id !== itemId);
          }
          continue; // 跳过这个项目，相当于删除
        }
        if (item.type === 'group') {
          result.push({
            ...item,
            children: removeItem(item.children || [])
          });
        } else {
          result.push(item);
        }
      }
      return result;
    };

    const updatedGroups = removeItem(currentSpace.groups);
    currentSpace.groups = updatedGroups;

    // 保存更新后的工作空间数据
    spaceStore.set('spaces', spaces);
    // 同步更新当前 store 中的数据
    store.set('groups', updatedGroups);
    store.set('activeSchemes', currentSpace.activeSchemes);
    
    return {
      success: true,
      groups: updatedGroups
    };
  } catch (error) {
    console.error('删除项目失败:', error);
    throw error;
  }
});

// 修改验证移动的处理器
ipcMain.handle('hosts:validate-move', async (event, { itemId, targetGroupId }) => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    const currentSpace = spaces.find(s => s.id === currentSpaceId);
    
    if (!currentSpace) {
      return {
        valid: false,
        reason: '当前工作空间不存在'
      };
    }

    // 查找源项目和其当前父级
    let sourceItem = null;
    let currentParentId = null;
    const findSourceAndParent = (items, parentId = null) => {
      for (const item of items) {
        if (item.id === itemId) {
          sourceItem = item;
          currentParentId = parentId;
          return true;
        }
        if (item.type === 'group' && item.children) {
          if (findSourceAndParent(item.children, item.id)) return true;
        }
      }
      return false;
    };

    // 检查目标是否是源的子孙
    const isDescendant = (items, targetId) => {
      for (const item of items) {
        if (item.id === targetId) return true;
        if (item.type === 'group' && item.children) {
          if (isDescendant(item.children, targetId)) return true;
        }
      }
      return false;
    };

    // 查找源项目和其当前父级
    findSourceAndParent(currentSpace.groups);
    if (!sourceItem) {
      return {
        valid: false,
        reason: '找不到要移动的项目'
      };
    }

    // 不能移动到自己
    if (itemId === targetGroupId) {
      return {
        valid: false,
        reason: '不能移动到自己'
      };
    }

    // 如果目标组就是当前父组，则不允许移动
    if (currentParentId === targetGroupId) {
      return {
        valid: false,
        reason: '项目已经在该分组中'
      };
    }

    // 如果是分组，检查是否会导致循环引用
    if (sourceItem.type === 'group' && sourceItem.children) {
      if (isDescendant(sourceItem.children, targetGroupId)) {
        return {
          valid: false,
          reason: '不能将分组移动到其子分组中'
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('验证移动失败:', error);
    return {
      valid: false,
      reason: error.message
    };
  }
});

// 创建托盘图标和菜单
function createTray() {
  // 创建托盘图标
  const iconPath = path.join(__dirname, 'assets/tray-icon.png'); // 你需要准备一个托盘图标
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  // 更新托盘菜单
  async function updateTrayMenu() {
    try {
      const groups = store.get('groups');
      const activeSchemes = store.get('activeSchemes');

      // 递归构建菜单项
      const buildMenuItems = (items) => {
        return items.map(item => {
          if (item.type === 'group') {
            return {
              label: item.name,
              submenu: buildMenuItems(item.children || [])
            };
          } else {
            return {
              label: item.name,
              type: 'checkbox',
              checked: activeSchemes.includes(item.id),
              click: async () => {
                try {
                  const newActiveSchemes = activeSchemes.includes(item.id)
                    ? activeSchemes.filter(id => id !== item.id)
                    : [...activeSchemes, item.id];
                  
                  await ipcMain.emit('hosts:update-active', null, newActiveSchemes);
                  updateTrayMenu(); // 更新菜单状态
                } catch (error) {
                  console.error('切换方案失败:', error);
                }
              }
            };
          }
        });
      };

      // 构建完整的菜单
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Hosts 方案',
          enabled: false,
          icon: trayIcon
        },
        { type: 'separator' },
        ...buildMenuItems(groups),
        { type: 'separator' },
        {
          label: '显示主窗口',
          click: () => {
            win.show();
            win.focus();
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            isQuiting = true;
            app.quit();
          }
        }
      ]);

      tray.setContextMenu(contextMenu);
    } catch (error) {
      console.error('更新托盘菜单失败:', error);
    }
  }

  // 设置托盘图标提示
  tray.setToolTip('Hosts Master');

  // 点击托盘图标显示主窗口
  tray.on('click', () => {
    win.show();
    win.focus();
  });

  // 监听数据变化，更新托盘菜单
  ipcMain.on('hosts:data-changed', updateTrayMenu);

  // 初始化托盘菜单
  updateTrayMenu();

  return tray;
}

// 修改导出功能
ipcMain.handle('hosts:export', async (event, { groupIds = [], format = 'json' } = {}) => {
  try {
    const groups = store.get('groups');
    let exportData;

    if (groupIds.length > 0) {
      // 导出选中的分组
      const findGroups = (items, targetIds) => {
        return items.filter(item => {
          if (targetIds.includes(item.id)) return true;
          if (item.type === 'group' && item.children) {
            item.children = findGroups(item.children, targetIds);
            return item.children.length > 0;
          }
          return false;
        });
      };
      exportData = findGroups(groups, groupIds);
    } else {
      // 导出所有数据
      exportData = groups;
    }

    // 根据格式选择不同的导出方式
    let defaultPath, filters;
    switch (format) {
      case 'excel':
        defaultPath = 'hosts-schemes.xlsx';
        filters = [{ name: 'Excel Files', extensions: ['xlsx'] }];
        break;
      case 'csv':
        defaultPath = 'hosts-schemes.csv';
        filters = [{ name: 'CSV Files', extensions: ['csv'] }];
        break;
      default:
        defaultPath = 'hosts-schemes.json';
        filters = [{ name: 'JSON Files', extensions: ['json'] }];
    }

    // 打开保存对话框
    const { filePath } = await dialog.showSaveDialog({
      title: '导出 Hosts 方案',
      defaultPath,
      filters
    });

    if (!filePath) {
      return { success: false, reason: '用户取消' };
    }

    // 根据格式执行不同的导出逻辑
    switch (format) {
      case 'excel':
        await exportToExcel(exportData, filePath);
        break;
      case 'csv':
        await exportToCSV(exportData, filePath);
        break;
      default:
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    }

    return { success: true };
  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  }
});

// Excel 导出函数
async function exportToExcel(data, filePath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Hosts 方案');

  // 设置表头
  worksheet.columns = [
    { header: '类型', key: 'type', width: 10 },
    { header: '名称', key: 'name', width: 20 },
    { header: '内容', key: 'content', width: 60 }
  ];

  // 递归添加数据
  function addRows(items, level = 0) {
    items.forEach(item => {
      worksheet.addRow({
        type: item.type,
        name: '  '.repeat(level) + item.name,
        content: item.type === 'scheme' ? item.content : ''
      });

      if (item.type === 'group' && item.children) {
        addRows(item.children, level + 1);
      }
    });
  }

  addRows(data);
  await workbook.xlsx.writeFile(filePath);
}

// CSV 导出函数
async function exportToCSV(data, filePath) {
  const rows = [];

  function addRows(items, path = '') {
    items.forEach(item => {
      const newPath = path ? `${path} > ${item.name}` : item.name;
      
      if (item.type === 'scheme') {
        rows.push({
          path: newPath,
          type: 'scheme',
          content: item.content
        });
      }

      if (item.type === 'group' && item.children) {
        addRows(item.children, newPath);
      }
    });
  }

  addRows(data);

  const fields = ['path', 'type', 'content'];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(rows);

  await fs.writeFile(filePath, csv, 'utf-8');
}

// 添加导入功能
ipcMain.handle('hosts:import', async (event, { parentId = 'root' } = {}) => {
  try {
    // 打开文件选择对话框
    const { filePaths } = await dialog.showOpenDialog({
      title: '导入 Hosts 方案',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (filePaths.length === 0) {
      return { success: false, reason: '用户取消' };
    }

    // 读取文件内容
    const content = await fs.readFile(filePaths[0], 'utf-8');
    const importData = JSON.parse(content);

    // 验证导入数据的格式
    const validateData = (items) => {
      return items.every(item => {
        if (!item.id || !item.name || !item.type) return false;
        if (item.type === 'group' && item.children) {
          return validateData(item.children);
        }
        return true;
      });
    };

    if (!Array.isArray(importData) || !validateData(importData)) {
      throw new Error('无效的导入文件格式');
    }

    // 生成新的 ID 映射
    const idMap = new Map();
    const regenerateIds = (items) => {
      return items.map(item => {
        const oldId = item.id;
        const newId = crypto.randomBytes(16).toString('hex');
        idMap.set(oldId, newId);

        const newItem = {
          ...item,
          id: newId
        };

        if (item.type === 'group' && item.children) {
          newItem.children = regenerateIds(item.children);
        }
        return newItem;
      });
    };

    const newData = regenerateIds(importData);

    // 将导入的数据添加到指定的父级分组
    const groups = store.get('groups');
    const updateGroups = (items, targetId, newItems) => {
      return items.map(item => {
        if (item.id === targetId) {
          return {
            ...item,
            children: [...(item.children || []), ...newItems]
          };
        }
        if (item.type === 'group' && item.children) {
          return {
            ...item,
            children: updateGroups(item.children, targetId, newItems)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(groups, parentId, newData);
    store.set('groups', updatedGroups);

    return { 
      success: true, 
      groups: updatedGroups,
      idMap: Object.fromEntries(idMap)
    };
  } catch (error) {
    console.error('导入失败:', error);
    throw error;
  }
});

// 添加远程方案相关的处理器
ipcMain.handle('hosts:create-remote-scheme', async (event, { parentId, name, remoteUrl, syncInterval }) => {
  try {
    // 获取远程内容
    const response = await axios.get(remoteUrl);
    const content = response.data;

    const newScheme = {
      id: crypto.randomBytes(16).toString('hex'),
      name,
      type: 'scheme',
      content,
      isRemote: true,
      remoteUrl,
      syncInterval: syncInterval || 3600000, // 默认1小时
      lastSync: Date.now()
    };

    const groups = store.get('groups');
    const updateGroups = (items) => {
      return items.map(item => {
        if (item.id === parentId) {
          return {
            ...item,
            children: [...item.children, newScheme]
          };
        }
        if (item.type === 'group') {
          return {
            ...item,
            children: updateGroups(item.children)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(groups);
    store.set('groups', updatedGroups);
    return newScheme;
  } catch (error) {
    console.error('创建远程方案失败:', error);
    throw error;
  }
});

// 添加同步远程方案的处理器
ipcMain.handle('hosts:sync-remote-scheme', async (event, { schemeId }) => {
  try {
    const groups = store.get('groups');
    let scheme = null;

    // 查找方案
    const findScheme = (items) => {
      for (const item of items) {
        if (item.id === schemeId) {
          scheme = item;
          return true;
        }
        if (item.type === 'group' && item.children) {
          if (findScheme(item.children)) return true;
        }
      }
      return false;
    };

    findScheme(groups);

    if (!scheme || !scheme.isRemote) {
      throw new Error('找不到远程方案');
    }

    // 获取远程内容
    const response = await axios.get(scheme.remoteUrl);
    const content = response.data;

    // 更新方案内容
    const updateGroups = (items) => {
      return items.map(item => {
        if (item.id === schemeId) {
          return {
            ...item,
            content,
            lastSync: Date.now()
          };
        }
        if (item.type === 'group') {
          return {
            ...item,
            children: updateGroups(item.children)
          };
        }
        return item;
      });
    };

    const updatedGroups = updateGroups(groups);
    store.set('groups', updatedGroups);

    // 如果方案处于激活状态，更新系统 hosts 文件
    const activeSchemes = store.get('activeSchemes');
    if (activeSchemes.includes(schemeId)) {
      await ipcMain.emit('hosts:update-active', null, activeSchemes);
    }

    return {
      success: true,
      content,
      lastSync: Date.now()
    };
  } catch (error) {
    console.error('同步远程方案失败:', error);
    throw error;
  }
});

// 启动时初始化自动同步
app.whenReady().then(() => {
  // 定期检查需要同步的远程方案
  setInterval(async () => {
    try {
      const groups = store.get('groups');
      const now = Date.now();

      // 查找所有需要同步的远程方案
      const findRemoteSchemes = (items) => {
        items.forEach(async (item) => {
          if (item.type === 'scheme' && item.isRemote) {
            const timeSinceLastSync = now - item.lastSync;
            if (timeSinceLastSync >= item.syncInterval) {
              // 触发同步
              await ipcMain.emit('hosts:sync-remote-scheme', null, { schemeId: item.id });
            }
          }
          if (item.type === 'group' && item.children) {
            findRemoteSchemes(item.children);
          }
        });
      };

      findRemoteSchemes(groups);
    } catch (error) {
      console.error('自动同步远程方案失败:', error);
    }
  }, 60000); // 每分钟检查一次
});

// 添加工作空间存储
const spaceStore = new Store({
  name: 'spaces-data',
  defaults: {
    spaces: [{
      id: 'default',
      name: '默认空间',
      groups: [{
        id: 'root',
        name: '根目录',
        type: 'group',
        children: [{
          id: 'default',
          name: '默认方案',
          type: 'scheme',
          content: '127.0.0.1 localhost',
          isRemote: false,
          remoteUrl: null,
          syncInterval: null,
          lastSync: null
        }]
      }],
      activeSchemes: []
    }],
    currentSpaceId: 'default'
  }
});

// 获取所有工作空间
ipcMain.handle('space:get-all', async () => {
  return spaceStore.get('spaces');
});

// 创建工作空间
ipcMain.handle('space:create', async (event, { name }) => {
  try {
    const spaces = spaceStore.get('spaces');
    const newSpace = {
      id: crypto.randomBytes(16).toString('hex'),
      name,
      groups: [{
        id: 'root',
        name: '根目录',
        type: 'group',
        children: []
      }],
      activeSchemes: []
    };

    spaces.push(newSpace);
    spaceStore.set('spaces', spaces);
    return newSpace;
  } catch (error) {
    console.error('创建工作空间失败:', error);
    throw error;
  }
});

// 切换工作空间
ipcMain.handle('space:switch', async (event, { spaceId }) => {
  try {
    const spaces = spaceStore.get('spaces');
    const space = spaces.find(s => s.id === spaceId);
    if (!space) {
      throw new Error('作空间不存在');
    }

    spaceStore.set('currentSpaceId', spaceId);
    store.set('groups', space.groups);
    store.set('activeSchemes', space.activeSchemes);

    return space;
  } catch (error) {
    console.error('切换工作空间失败:', error);
    throw error;
  }
});

// 获取当前工作空间
ipcMain.handle('space:get-current', async () => {
  try {
    const currentSpaceId = spaceStore.get('currentSpaceId');
    const spaces = spaceStore.get('spaces');
    return spaces.find(s => s.id === currentSpaceId) || null;
  } catch (error) {
    console.error('获取当前工作空间失败:', error);
    throw error;
  }
});

// 重命名工作空间
ipcMain.handle('space:rename', async (event, { spaceId, newName }) => {
  try {
    const spaces = spaceStore.get('spaces');
    const space = spaces.find(s => s.id === spaceId);
    if (!space) {
      throw new Error('工作空间不存在');
    }

    space.name = newName;
    spaceStore.set('spaces', spaces);
    return space;
  } catch (error) {
    console.error('重命名工作空间失败:', error);
    throw error;
  }
});

// 删除工作空间
ipcMain.handle('space:delete', async (event, { spaceId }) => {
  try {
    const spaces = spaceStore.get('spaces');
    const index = spaces.findIndex(s => s.id === spaceId);
    if (index === -1) {
      throw new Error('工作空间不存在');
    }

    // 不允许删除最后一个工作空间
    if (spaces.length === 1) {
      throw new Error('不能删除最后一个工作空间');
    }

    // 如果删除的是当前工作空间，切换到第一个可用的工作空间
    const currentSpaceId = spaceStore.get('currentSpaceId');
    if (currentSpaceId === spaceId) {
      const newCurrentSpace = spaces.find(s => s.id !== spaceId);
      if (newCurrentSpace) {
        spaceStore.set('currentSpaceId', newCurrentSpace.id);
        store.set('groups', newCurrentSpace.groups);
        store.set('activeSchemes', newCurrentSpace.activeSchemes);
      }
    }

    spaces.splice(index, 1);
    spaceStore.set('spaces', spaces);
    return true;
  } catch (error) {
    console.error('删除工作空间失败:', error);
    throw error;
  }
});

// 添加网络检测相关的处理器
ipcMain.handle('network:ping', async (event, { host }) => {
  try {
    const result = await ping.promise.probe(host, {
      timeout: 5,
      extra: ['-c', '1']
    });

    return {
      success: result.alive,
      time: parseFloat(result.time),
      error: result.alive ? null : 'Host unreachable'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('network:dns', async (event, { domain }) => {
  try {
    const addresses = await dns.resolve(domain);
    return {
      success: true,
      addresses
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('network:http-check', async (event, { url }) => {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'HostsMaster/1.0'
      }
    }, (response) => {
      resolve({
        success: response.statusCode >= 200 && response.statusCode < 400,
        statusCode: response.statusCode,
        headers: response.headers
      });
    });

    request.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });
  });
});

// 添加定时任务存储
const scheduleStore = new Store({
  name: 'schedules-data',
  defaults: {
    schedules: []
  }
});

// 存储定时器的 Map
const scheduleTimers = new Map();

// 添加定时任务处理器
ipcMain.handle('schedule:add', async (event, config) => {
  try {
    const schedules = scheduleStore.get('schedules');
    const newSchedule = {
      id: crypto.randomBytes(16).toString('hex'),
      ...config,
      createdAt: Date.now()
    };

    // 设置定时器
    if (config.type === 'temporary') {
      // 临时启用，到期后自动禁用
      const timer = setTimeout(async () => {
        const activeSchemes = store.get('activeSchemes');
        const newActiveSchemes = activeSchemes.filter(id => id !== config.itemId);
        await ipcMain.emit('hosts:update-active', null, newActiveSchemes);
        
        // 移除定时任务
        const currentSchedules = scheduleStore.get('schedules');
        scheduleStore.set('schedules', currentSchedules.filter(s => s.id !== newSchedule.id));
        scheduleTimers.delete(newSchedule.id);
      }, config.duration);

      scheduleTimers.set(newSchedule.id, timer);
    } else {
      // 定时启用或禁用
      const setNextTimer = () => {
        let nextTime;
        const now = Date.now();

        switch (config.repeat) {
          case 'daily':
            nextTime = new Date(config.executeTime);
            while (nextTime.getTime() <= now) {
              nextTime.setDate(nextTime.getDate() + 1);
            }
            break;
          case 'weekly':
            nextTime = new Date(config.executeTime);
            while (nextTime.getTime() <= now) {
              nextTime.setDate(nextTime.getDate() + 7);
            }
            break;
          case 'monthly':
            nextTime = new Date(config.executeTime);
            while (nextTime.getTime() <= now) {
              nextTime.setMonth(nextTime.getMonth() + 1);
            }
            break;
          default: // once
            nextTime = new Date(config.executeTime);
            if (nextTime.getTime() <= now) {
              return; // 一次性任务已过期
            }
        }

        const timer = setTimeout(async () => {
          const activeSchemes = store.get('activeSchemes');
          const newActiveSchemes = config.type === 'activate'
            ? [...new Set([...activeSchemes, config.itemId])]
            : activeSchemes.filter(id => id !== config.itemId);

          await ipcMain.emit('hosts:update-active', null, newActiveSchemes);

          if (config.repeat !== 'once') {
            setNextTimer(); // 设置下一次执行
          } else {
            // 移除一次性任务
            const currentSchedules = scheduleStore.get('schedules');
            scheduleStore.set('schedules', currentSchedules.filter(s => s.id !== newSchedule.id));
            scheduleTimers.delete(newSchedule.id);
          }
        }, nextTime.getTime() - now);

        scheduleTimers.set(newSchedule.id, timer);
      };

      setNextTimer();
    }

    schedules.push(newSchedule);
    scheduleStore.set('schedules', schedules);

    return newSchedule;
  } catch (error) {
    console.error('添加定时任务失败:', error);
    throw error;
  }
});

// 移除定时任务处理器
ipcMain.handle('schedule:remove', async (event, { scheduleId }) => {
  try {
    const schedules = scheduleStore.get('schedules');
    const index = schedules.findIndex(s => s.id === scheduleId);
    
    if (index === -1) {
      throw new Error('找不到定时任务');
    }

    // 清除定时器
    const timer = scheduleTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      scheduleTimers.delete(scheduleId);
    }

    schedules.splice(index, 1);
    scheduleStore.set('schedules', schedules);

    return true;
  } catch (error) {
    console.error('移除定时任务失败:', error);
    throw error;
  }
});

// 获取所有定时任务处理器
ipcMain.handle('schedule:get-all', async () => {
  return scheduleStore.get('schedules');
});

// 获取活动定时任务处理器
ipcMain.handle('schedule:get-active', async () => {
  const schedules = scheduleStore.get('schedules');
  return schedules.filter(schedule => {
    if (schedule.type === 'temporary') {
      return schedule.createdAt + schedule.duration > Date.now();
    } else {
      const executeTime = new Date(schedule.executeTime).getTime();
      return executeTime > Date.now() || schedule.repeat !== 'once';
    }
  });
});

// 应用启动时初始化定时任务
app.whenReady().then(() => {
  const schedules = scheduleStore.get('schedules');
  schedules.forEach(schedule => {
    if (schedule.type === 'temporary') {
      const remainingTime = schedule.createdAt + schedule.duration - Date.now();
      if (remainingTime > 0) {
        const timer = setTimeout(async () => {
          const activeSchemes = store.get('activeSchemes');
          const newActiveSchemes = activeSchemes.filter(id => id !== schedule.itemId);
          await ipcMain.emit('hosts:update-active', null, newActiveSchemes);
          
          const currentSchedules = scheduleStore.get('schedules');
          scheduleStore.set('schedules', currentSchedules.filter(s => s.id !== schedule.id));
          scheduleTimers.delete(schedule.id);
        }, remainingTime);

        scheduleTimers.set(schedule.id, timer);
      }
    } else {
      // ... 其他定时任务的初始化逻辑保持不变 ...
    }
  });
});

// 存储 SSH 会话
const sshSessions = new Map();

// 添加 SSH 连接处理器
ipcMain.handle('ssh:connect', async (event, config) => {
  try {
    const conn = new Client();
    
    // 创建一个唯一的会话 ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        sshSessions.set(sessionId, conn);
        resolve({ sessionId });
      }).on('error', (err) => {
        reject(err);
      }).connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.authType === 'password' ? config.password : undefined,
        privateKey: config.authType === 'privateKey' ? 
          fs.readFileSync(config.privateKeyPath) : undefined,
        passphrase: config.passphrase
      });
    });
  } catch (error) {
    console.error('SSH连接失败:', error);    throw error;
  }
});

// 添加版本存储
const versionStore = new Store({
  name: 'versions-data',
  defaults: {
    versions: {} // 使用空对象作为初始值，key 为 spaceId
  }
});

// 获取版本列表
ipcMain.handle('version:get-all', async (event, { spaceId }) => {
  try {
    const allVersions = versionStore.get('versions');
    return allVersions[spaceId] || [];
  } catch (error) {
    console.error('获取版本列表失败:', error);
    return [];
  }
});

// 创建新版本
ipcMain.handle('version:create', async (event, { spaceId, content }) => {
  try {
    const allVersions = versionStore.get('versions');
    const spaceVersions = allVersions[spaceId] || [];
    
    const newVersion = {
      id: crypto.randomBytes(16).toString('hex'),
      content,
      timestamp: Date.now(),
      description: `版本 ${spaceVersions.length + 1}`
    };

    allVersions[spaceId] = [newVersion, ...spaceVersions];
    versionStore.set('versions', allVersions);

    return newVersion;
  } catch (error) {
    console.error('创建版本失败:', error);
    throw error;
  }
});

// 断开 SSH 连接
ipcMain.handle('ssh:disconnect', async (event, { sessionId }) => {
  try {
    const conn = sshSessions.get(sessionId);
    if (conn) {
      conn.end();
      sshSessions.delete(sessionId);
    }
    return true;
  } catch (error) {
    console.error('断开SSH连接失败:', error);
    throw error;
  }
});

// 更新远程 hosts 文件
ipcMain.handle('ssh:update-hosts', async (event, { sessionId, content }) => {
  try {
    const conn = sshSessions.get(sessionId);
    if (!conn) {
      throw new Error('SSH会话不存在');
    }

    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        // 创建临时文件
        const tempPath = path.join(os.tmpdir(), `hosts-${sessionId}`);
        fs.writeFile(tempPath, content)
          .then(() => {
            // 使用 SFTP 上传文件
            sftp.fastPut(tempPath, '/etc/hosts', (err) => {
              // 清理临时文件
              fs.unlink(tempPath).catch(console.error);
              
              if (err) {
                reject(err);
              } else {
                resolve(true);
              }
            });
          })
          .catch(reject);
      });
    });
  } catch (error) {
    console.error('更新远程hosts文件失败:', error);
    throw error;
  }
});

// 读取远程 hosts 文件
ipcMain.handle('ssh:read-hosts', async (event, { sessionId }) => {
  try {
    const conn = sshSessions.get(sessionId);
    if (!conn) {
      throw new Error('SSH会话不存在');
    }

    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        // 创建临时文件
        const tempPath = path.join(os.tmpdir(), `hosts-${sessionId}`);
        
        // 使用 SFTP 下载文件
        sftp.fastGet('/etc/hosts', tempPath, async (err) => {
          if (err) {
            reject(err);
            return;
          }

          try {
            const content = await fs.readFile(tempPath, 'utf-8');
            await fs.unlink(tempPath); // 清理临时文件
            resolve(content);
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  } catch (error) {
    console.error('读取远程hosts文件失败:', error);
    throw error;
  }
});

// 测试 SSH 连接
ipcMain.handle('ssh:test', async (event, config) => {
  try {
    const conn = new Client();
    
    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        // 测试成功后立即断开连接
        conn.end();
        resolve({ success: true });
      }).on('error', (err) => {
        reject(err);
      }).connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.authType === 'password' ? config.password : undefined,
        privateKey: config.authType === 'privateKey' ? 
          fs.readFileSync(config.privateKeyPath) : undefined,
        passphrase: config.passphrase
      });
    });
  } catch (error) {
    console.error('SSH连接测试失败:', error);
    throw error;
  }
});

// 获取远程系统信息
ipcMain.handle('ssh:system-info', async (event, { sessionId }) => {
  try {
    const conn = sshSessions.get(sessionId);
    if (!conn) {
      throw new Error('SSH会话不存在');
    }

    return new Promise((resolve, reject) => {
      conn.exec('uname -s', (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let data = '';
        stream.on('data', (chunk) => {
          data += chunk;
        }).on('end', () => {
          const systemType = data.trim().toLowerCase();
          let hostsPath = '/etc/hosts';
          
          // Windows 系统使用不同的路径
          if (systemType.includes('windows')) {
            hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
          }

          resolve({
            type: systemType,
            hostsPath
          });
        }).on('error', reject);
      });
    });
  } catch (error) {
    console.error('获取远程系统信息失败:', error);
    throw error;
  }
});

// 回滚到指定版本
ipcMain.handle('version:rollback', async (event, { spaceId, versionId }) => {
  try {
    const allVersions = versionStore.get('versions');
    const spaceVersions = allVersions[spaceId] || [];
    
    const version = spaceVersions.find(v => v.id === versionId);
    if (!version) {
      throw new Error('找不到指定版本');
    }

    // 创建新版本记录回滚操作
    const newVersion = {
      id: crypto.randomBytes(16).toString('hex'),
      content: version.content,
      timestamp: Date.now(),
      description: `回滚到版本 ${version.description}`
    };

    allVersions[spaceId] = [newVersion, ...spaceVersions];
    versionStore.set('versions', allVersions);

    return {
      success: true,
      version: newVersion
    };
  } catch (error) {
    console.error('回滚版本失败:', error);
    throw error;
  }
});
