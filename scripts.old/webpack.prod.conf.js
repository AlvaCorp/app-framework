'use strict'

// Load packages
var env = require('../env')
var path = require('path')
var utils = require('./utils')
var webpack = require('webpack')
var merge = require('webpack-merge')
var found = require('../lib/found')
var deleteFiles = require('delete')
var baseWebpackConfig = require('./webpack.base.conf')
var ExtractTextPlugin = require('extract-text-webpack-plugin')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var AppCachePlugin = require('appcache-webpack-plugin')
var OnBuildPlugin = require('on-build-webpack')
var replace = require('replace-in-file')
var copy = require('fs-extra').copySync
var write = require('write')
var list = require('list-dir')
var rename = require('fs').renameSync
var fs = require('fs-extra')

// Load configuration
var cfg = require('./config.js')
var pkg = env.pkg

// Update copyright year in license
if (!cfg.isInstalled) {
  replace.sync({
    files: path.resolve(__dirname, '../LICENSE'),
    from: /Copyright \(c\) ([0-9]{4}) scriptPilot/,
    to: 'Copyright (c) ' + (new Date()).getFullYear() + ' scriptPilot'
  })
}

// Update version in demo app
/*
if (!cfg.isInstalled) {
  var demoApp = require(env.proj + 'package.json')
  demoApp.version = pkg.version
  fs.writeJsonSync(cfg.appRoot + 'package.json', demoApp, {spaces: 2})
}
*/

// Load app configuration
var app = require(cfg.appRoot + 'config.json')

// Create and save manifest (see http://realfavicongenerator.net/faq for details)
let manifest = {
  name: app.title,
  icons: [
    {
      'src': 'android-chrome-192x192.png',
      'sizes': '192x192',
      'type': 'image/png'
    },
    {
      'src': 'android-chrome-512x512.png',
      'sizes': '512x512',
      'type': 'image/png'
    }
  ],
  theme_color: app.iconBackgroundColor,
  background_color: app.iconBackgroundColor,
  display: 'standalone'
}

// Add icon tags
let iconTags = '<meta name="theme-color" content="' + app.iconBackgroundColor + '" />' +
               '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />' +
               '<link rel="icon" type="image/png" href="favicon-32x32.png" sizes="32x32" />' +
               '<link rel="icon" type="image/png" href="favicon-16x16.png" sizes="16x16" />' +
               '<link rel="manifest" href="manifest.json" />'

// Define production webpack configuration
var webpackConfig = merge(baseWebpackConfig, {
  module: {
    loaders: utils.styleLoaders({ sourceMap: cfg.build.productionSourceMap, extract: true })
  },
  devtool: cfg.build.productionSourceMap ? '#source-map' : false,
  output: {
    path: path.resolve(cfg.appRoot, 'www/build-' + app.version),
    filename: '[name].[chunkhash].js',
    chunkFilename: '[id].[chunkhash].js'
  },
  vue: {
    loaders: utils.cssLoaders({
      sourceMap: cfg.build.productionSourceMap,
      extract: true
    })
  },
  plugins: [
    new ExtractTextPlugin('[name].[contenthash].css'),
    new HtmlWebpackPlugin({
      //filename: path.resolve(cfg.appRoot, 'www/build-' + app.version + '/index.html'),
      //template: 'index.ejs',
      //title: app.title,
      iconTags: iconTags,
      //manifest: ' manifest="manifest.appcache"',
      //inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
      },
      chunksSortMode: 'dependency'
    }),
    new AppCachePlugin({
      cache: null,
      network: ['*'],
      fallback: null,
      settings: null,
      exclude: [/\.(js|css)\.map$/],
      output: 'manifest.appcache'
    }),
    new OnBuildPlugin(function (stats) {
      // Save manifest file
      write.sync(path.resolve(cfg.appRoot, 'www/build-' + app.version, 'manifest.json'), JSON.stringify(manifest))

      // Save browserconfig file
      let xml = '<?xml version="1.0" encoding="utf-8"?>' +
                '<browserconfig>' +
                  '<msapplication>' +
                    '<tile>' +
                      '<square150x150logo src="mstile-150x150.png"/>' +
                      '<TileColor>#da532c</TileColor>' +
                    '</tile>' +
                  '</msapplication>' +
                '</browserconfig>'
      write.sync(path.resolve(cfg.appRoot, 'www/build-' + app.version, 'browserconfig.xml'), xml)

      // Copy icon files (see http://realfavicongenerator.net/faq for details)
      copy(path.resolve(cfg.packageRoot, 'icons/favicon-*'), path.resolve(cfg.appRoot, 'www/build-' + app.version))
      copy(path.resolve(cfg.packageRoot, 'icons/android-chrome-*'), path.resolve(cfg.appRoot, 'www/build-' + app.version))
      copy(path.resolve(cfg.packageRoot, 'icons/mstile-*'), path.resolve(cfg.appRoot, 'www/build-' + app.version))
      copy(path.resolve(cfg.packageRoot, 'icons/apple-touch-icon-*'), path.resolve(cfg.appRoot, 'www/build-' + app.version))

      // Rename Apple touch icon
      rename(path.resolve(cfg.appRoot, 'www/build-' + app.version, 'apple-touch-icon-180x180.png'), path.resolve(cfg.appRoot, 'www/build-' + app.version, 'apple-touch-icon.png'))

      // Compress images
      let images = list(path.resolve(cfg.appRoot, 'www/build-' + app.version + '/img'))
      for (let i = 0; i < images.length; i++) {
        console.log('Compress ' + images[i])
      }

      // Update version in .htaccess file after successful build
      replace.sync({
        files: cfg.appRoot + 'www/.htaccess',
        from: /\/build-([0-9]+)\.([0-9]+)\.([0-9]+)\//g,
        to: '/build-' + app.version + '/'
      })

      // Delete Framework7 icon from CSS file
      deleteFiles([path.resolve(cfg.appRoot, 'www/build-' + app.version, 'i-f7-ios*')])

      // Delete .babelrc file
      if (cfg.isInstalled && found(cfg.projectRoot + '.babelrc')) {
        fs.remove(cfg.projectRoot + '.babelrc')
      }
    })
  ]
})

// Optionally, add compression plugin
if (cfg.build.productionGzip) {
  var CompressionWebpackPlugin = require('compression-webpack-plugin')
  webpackConfig.plugins.push(
    new CompressionWebpackPlugin({
      asset: '[path].gz[query]',
      algorithm: 'gzip',
      test: new RegExp(
        '\\.(' +
        cfg.build.productionGzipExtensions.join('|') +
        ')$'
      ),
      threshold: 10240,
      minRatio: 0.8
    })
  )
}

module.exports = webpackConfig
