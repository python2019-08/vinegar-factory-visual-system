<template>
  <LayoutPanel>
    <div class="container">
      <div class="item" v-for="item in list">
        <div class="item-label">{{ item.label }}</div>
        <div class="item-value">{{ item.value }}{{ item.unit }}</div>
      </div>
    </div>
  </LayoutPanel>
</template>
<script setup lang="ts">
import { LayoutPanel } from '@/layout'
import { computed } from 'vue'

interface PropsType {
  name: string
}
const props = defineProps<PropsType>()

const CONFIG: any = {
  变桨系统: [
    { label: '变桨角度', value: 15, unit: '度' },
    { label: '变桨速度', value: 2, unit: '度/秒' },
    { label: '变桨系统温度', value: 45, unit: '摄氏度' },
    { label: '电机负载', value: 3.5, unit: '千瓦' },
    { label: '变桨位置传感器反馈', value: 1.2, unit: '米' },
    { label: '故障状态', value: 0, unit: '(无故障)' },
    { label: '电源电压', value: 400, unit: '伏特' },
    { label: '桨叶压力', value: 1200, unit: '帕斯卡' },
    { label: '变桨角度变化', value: 0.5, unit: '度' },
    { label: '变桨响应时间', value: 0.1, unit: '秒' },
    { label: '电流', value: 10, unit: '安培' },
    { label: '变桨系统运行时间', value: 200, unit: '小时' },
    { label: '变桨故障次数', value: 1, unit: '' },
    { label: '系统工作状态', value: '正常', unit: '' },
    { label: '变桨电机温度', value: 60, unit: '摄氏度' },
    { label: '变桨角度限制', value: 25, unit: '度' },
  ],  
  控制柜: [
    { label: '控制柜类型', value: '配电控制柜', unit: '' },
    { label: '额定电压', value: 400, unit: '伏特' },
    { label: '额定电流', value: 100, unit: '安培' },
    { label: '防护等级', value: 'IP65', unit: '' },
    { label: '控制方式', value: '自动控制', unit: '' },
    { label: '柜体材料', value: '冷轧钢', unit: '' },
    { label: '柜体重量', value: 150, unit: '千克' },
    { label: '工作温度', value: 40, unit: '摄氏度' },
    { label: '柜内电流', value: 80, unit: '安培' },
    { label: '柜内电压', value: 380, unit: '伏特' },
    { label: '控制柜工作状态', value: '正常', unit: '' },
    { label: '柜体温度', value: 50, unit: '摄氏度' },
    { label: '柜内项目数量', value: 20, unit: '' },
    { label: '控制柜检修周期', value: 3, unit: '年' },
    { label: '柜体振动状态', value: '正常', unit: '' },
    { label: '柜体防护等级测试', value: '合格', unit: '' },
  ],
}

const list = computed(() => {
  return CONFIG[props.name] || []
})
</script>

<style lang="scss" scoped>
.container {
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  grid-template-columns: repeat(4, 1fr);
  grid-gap: 10px;
  height: 100%;
  overflow: hidden;
  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(93, 101, 122, 20%);
    .item-label {
      font-size: 12px;
    }
    .item-value {
      margin-top: 4px;
      font-size: 12px;
      color: #74f7fd;
    }
  }
}
</style>
