<!-- 
关键交互流程说明:
(1)加载阶段：Layout 接收 loading 对象。当 loading.isLoading 为 true 时，界面会覆盖一层加载动画。
(2)渲染阶段：useFactory 内部的 nextTick 触发后，Three.js 开始在 container 所在的 div 中画图。
-->
<template>
  <Layout :loading="loading">
    
    <template #left>
      <WidgetPanel04 title="参数监测" />
      <!-- 
        <WidgetPanel02 title="历史功率" />
        <WidgetPanel03 title="日发电量监测 " />      
      -->
    </template>

    <template #right>
      <WidgetPanel07
        v-show="current"
        :title="current + '详情'"
        :name="current"
      />
      <WidgetPanel06 v-show="!current" title="运行监测" />      
      <WidgetPanel01 title="每月产量柱状图" /> 
      <!-- <WidgetPanel05 title="偏航角度监测" /> -->
    </template>

    <template #middle>
      <div style="width: 100%; height: 100%" ref="container"></div>
    </template>

  </Layout>
</template>

<!--   引入布局组件   -->
<script setup lang="ts">
import {
  WidgetPanel01,
  WidgetPanel02,
  WidgetPanel03,
  WidgetPanel04,
  WidgetPanel05,
  WidgetPanel06,
  WidgetPanel07,
} from '@/components'
import { provide } from 'vue'
import { Layout } from '@/layout'
import { useFactory } from '@/hooks'

const {
  container,
  loading,
  current,
  // eqDecomposeAnimation,
  // eqComposeAnimation,
  startWarning,
  stopWarning,
} = useFactory()

// 跨组件通信：provide
// 作用：这是一种“深度广播”机制。
// 场景：假设你的 WidgetPanel04（左侧面板）里有一个“分解模型”的按钮。因为 App.vue 
//      通过 provide 提供了这些动画函数，面板组件内部只需要用 inject('events') 
//      就能直接触发 3D 场景里的分解或组合动画。
// 优点：避免了繁琐的父子组件传参（Props Drilling）。
provide('events', {
  // eqDecomposeAnimation,
  // eqComposeAnimation,
  startWarning,
  stopWarning,
})
</script>
