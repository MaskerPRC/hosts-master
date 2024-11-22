const { defineConfig } = require('@vue/cli-service')
const WebpackObfuscator = require('webpack-obfuscator');
const webpack = require('webpack');

module.exports = defineConfig({
  devServer: {
    proxy: {
      // 匹配所有以 /api 开头的请求
      '/api': {
        target: 'http://localhost:3000', // 代理的目标服务器地址
        changeOrigin: true, // 是否改变请求源（通常需要设为 true）
        ws: true, // 是否代理 WebSocket
        pathRewrite: {
          '^/api': '/api', // 重写路径，将 /api 前缀删除
        },
      },
    },
  },
  transpileDependencies: true,
  configureWebpack: {
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.node$/,
          loader: 'node-loader',
        },
      ],
    },
    resolve: {
      fallback: {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert/"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url/")
      }
    }
  },
  pluginOptions: {
    electronBuilder: {
      chainWebpackMainProcess: (config) => {
        config.devtool('source-map');
         // adding rule for .node file handling
         config.module
         .rule('node')
         .test(/\.node$/)
         .use('node-loader')
         .loader('node-loader')
         .end();
      },
      builderOptions: {
        files: [
          {
            // 包含所有文件
            from: '.',
            to: '.',
          },
          {
            // 排除 .map 文件
            from: '.',
            to: '.',
            filter: ['**/*', '!**/*.map'],
          },
        ],
      },
      nodeIntegration: true
    },
  },
})
