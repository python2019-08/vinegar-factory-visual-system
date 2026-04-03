import { nextTick, ref, reactive } from 'vue'
import { forEach, random } from 'lodash-es'
import useThree from './useThree'
import TWEEN from 'three/examples/jsm/libs/tween.module.js'
import * as THREE from 'three'
import WidgetLabel from '@/components/WidgetLabel.vue'

const CONFIG = {
  HDR_source: `${import.meta.env.VITE_API_DOMAIN}/hdr/venice_sunset_1k.hdr`,

  // MODEL_SOURCES: 使用环境变量 VITE_API_DOMAIN 动态拼接模型路径，方便在开发环境和生产环境之间切换。
  MODEL_SOURCES: {
    EQUIPMENT: `${import.meta.env.VITE_API_DOMAIN}/models/vinegar_factory8.glb`,
    PLANE: `${import.meta.env.VITE_API_DOMAIN}/models/plane.glb`, 
  },
  // 
  MODEL_SCALES: [1.0, 1.0, 1.0],
 
} as const

export function useFactory() {
  const {
    container,
    scene,
    camera,
    ocontrol,
    outlinePass,
    hexPass,
    loadBgEnv,
    loadGltf,
    loadAnimationMixer,
    loadCSS2DByVue,
    addModelPick,
    addModelHoverPick,
    addOutlineEffect,
    transitionAnimation,
    planeClippingAnimation,
  } = useThree()

  const current = ref('')

  const isAnimation = ref(false)

  // labelGroup: 一个专门存放 CSS2D 标签的“抽屉”。通过将所有标签放入一个 Group，你可以一键隐藏或删除它们，而不需要遍历整个场景。
  const labelGroup = new THREE.Group()

  const models = {
    // null as any,ts特有语法。null，是初始值。as any,类型断言，允许以后赋值为任何类型（any）
    equipment: null as any,
    plane: null as any, 
  }
 

  // reactive 是 Vue3 响应式系统的核心 API。作用是把一个普通的 JS对象转换成一个**“能够被 Vue 监控”的响应式对象**
  // Reactive对象：当你修改 loading.loaded = 1 时，Vue 会立即察觉到变化，并自动更新所有引用了这个数据的 HTML 界面（比如进度条的宽度、百分比数字）
  // 
  // reactive vs ref 的区别：
  // ref：通常用于简单类型（字符串、数字、布尔值），在 JS 中访问需要加 .value。
  // reactive：专门用于复杂对象。它的好处是访问属性时不需要写 .value，代码看起来更像原生的对象操作，非常适合管理这种“一组相关联的状态”。
  const loading = reactive({
    total: 2, // 全部
    loaded: 0, // 已加载
    isLoading: true, // 执行状态
  })



  const boostrap = async () => {
    await loadModels() // 加载风机模型
    loadLights() // 加载灯光
    await openingAnimation() // 开场动画

    // addModelPick(models.equipment, (intersects) => {
    //   if (intersects.length > 0) 
    //   {
    //     // console.log(intersects)
    //     const intersect = intersects[0];
    //     const obj = intersects[0]['object']

    //     if(obj.name.includes('jar'))
    //     {
    //       // 检查是否是实例化网格 (InstancedMesh)
    //       if (obj.isInstancedMesh) {
    //         // 获取被点击的那个罐子的索引
    //         const instanceId = intersect.instanceId;
            
    //         console.log(`点击了组: ${obj.name}, 罐子索引: ${instanceId}`);

    //         // 注意：OutlinePass / Selection 通常不支持选中 InstancedMesh 的单个子实例
    //         // 因为它们在内存中是同一个绘制批次。
    //         // 你可以先记录下当前选中的 ID 
    //         current.value = `${obj.name}_${instanceId}`;
            
    //         // 如果你想让该罐子高亮，通常有两种做法：
    //         // 1. 修改该实例的颜色（通过 setInstanceColorAt）
    //         // 2. 在该位置动态创建一个临时的 Mesh 用于 Outline 展示
    //         // highlightInstance(obj, instanceId);


    //       } else {
    //         // 普通 Mesh 的处理逻辑
    //         current.value = obj.name;
    //         hexPass.value!.selectedObjects = [obj];
    //       }
    //     } 

    //   } else {
    //     current.value = ''
    //     // outlinePass.value!.selectedObjects = []
    //     hexPass.value!.selectedObjects = []
    //   }
    // })
  const highlightColor = new THREE.Color(0x0000ff); // 选中时的色
  const defaultColor = new THREE.Color(0xffffff);  // 恢复时的色
  let lastSelectedMesh : any = null;
  let lastInstanceId = -1;

addModelPick(models.equipment, (intersects) => {

  let isInstanceClicked = false;
  if (intersects.length > 0) 
  {
    const intersect = intersects[0];
    const intersect_obj = intersect.object;
    // console.log(intersect) 

    if (intersect_obj.isInstancedMesh) {
      isInstanceClicked = true;
      const instanceId = intersect.instanceId;

      // 1. 恢复上一个选中的罐子颜色
      if (lastSelectedMesh && 
          lastSelectedMesh.isInstancedMesh && 
          lastInstanceId !== -1) 
      {
        lastSelectedMesh.setColorAt(lastInstanceId, defaultColor);
        lastSelectedMesh.instanceColor.needsUpdate = true;
      } 

      // 1. 设置颜色（例如变成亮绿色） 
      intersect_obj.setColorAt(instanceId, highlightColor);

      // 2. 告诉 GPU 更新颜色数据
      // 注意：如果之前没初始化 instanceColor，请参考我之前的回复初始化一下
      intersect_obj.instanceColor.needsUpdate = true;      
       

      // 记录当前状态用于下次恢复
      lastSelectedMesh = intersect_obj;
      lastInstanceId = instanceId;
      
      current.value = `${intersect_obj.name}_${instanceId}`;

    }
  }
  
  if(!isInstanceClicked)
  {
    // 点击 非instance，恢复颜色
    if (lastSelectedMesh && lastInstanceId !== -1) {
      lastSelectedMesh.setColorAt(lastInstanceId, defaultColor);
      lastSelectedMesh.instanceColor.needsUpdate = true;
      lastSelectedMesh = null;
      lastInstanceId = -1;
    }
    current.value = '';
  }
});    


    // addModelHoverPick(models.equipment, (intersects) => {
    //   if (intersects.length > 0) 
    //   {
    //     const obj = intersects[0]['object']
    //     hexPass.value!.selectedObjects = [obj]
    //   } else {
    //     hexPass.value!.selectedObjects = []
    //   }
    // })
  }

  //加载机架和设备模型
  const loadModels = async () => {     

    const loadBg = async () => {
      const env = await loadBgEnv(CONFIG.HDR_source)  
      loading.loaded += 1
    }
    
    const loadEquipment = async () => {
      const gltf = await loadGltf(CONFIG.MODEL_SOURCES.EQUIPMENT)
      const model = gltf.scene
      model.scale.set(...CONFIG.MODEL_SCALES)
      models.equipment = model
      loading.loaded += 1
      model.name = 'equipment'
      scene.value!.add(model)
    }
 
    await Promise.all([loadEquipment(),loadBg() ])
    loading.isLoading = false
    loading.loaded = 2
  }
  //加载灯光
  const loadLights = () => {
    const LIGHT_LIST = [
      [0, 0, 0],
      [-100, 100, 100],
      [100, -100, 100],
      [100, 100, -100],
    ]
    forEach(LIGHT_LIST, ([x, y, z]) => {
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
      directionalLight.position.set(x, y, z)
      scene.value?.add(directionalLight)
    })
  }

  //开场动画:白色的设备外壳逐渐消失，同时镜头平滑地切入到最佳观察位。
  //   利用 并行执行（Parallel Execution） 来同时控制视觉特效和镜头轨迹
  const openingAnimation = () => {
    // Promise: 保证了外部调用者可以知道动画何时结束（例如：等开场动画播完后，再弹出 UI 面板）。
    return new Promise((resolve) => {
      // (1) 状态锁定与 Promise 封装
      // isAnimation.value = true: 这是一个典型的“操作锁”。在开场动画播放的这几秒内，
      //     防止用户通过鼠标点击或拖拽干扰相机的预设轨迹。
      isAnimation.value = true
       

      // 镜头移动
      // (3) 镜头推进 (运镜核心)
      // 运镜轨迹：相机从初始位置（通常是很远的地方）快速拉近到 { x: 0.5, y: 2.8, z: 0.5 }。
      // 缓动函数 (Quintic.InOut)：这是一种极其丝滑的曲线，开始慢，中间快，结尾带一点缓冲。
      // 时间节奏：持续 2 秒。
      transitionAnimation({
        from: camera.value!.position,
        to: { x: 0.5, y: 0.5, z: 0.5 },
        duration: 1000 * 2,
        easing: TWEEN.Easing.Quintic.InOut,
        onUpdate: ({ x, y, z }: any) => {
          camera.value!.position.set(x, y, z)

          // 代码细节中的“避坑”点(1/2)
          // ocontrol.value?.update(): 在相机移动的每一帧（onUpdate）都调用这个方法是必须的。
          // 因为 OrbitControls（轨道控制器）内部维护着一个“目标点”。如果你只动相机不动控制器，
          // 动画一结束，画面可能会因为控制器的冲突而瞬间“闪跳”。          
          ocontrol.value?.update()
        },
        onComplete() {
          // 在动画的 onComplete 里 写了 isAnimation.value = false。   
          isAnimation.value = false
          resolve(void 0)
        },
      }).start()  
 
    })
  }
 
   


  const warningTimer = ref()

  //开始模拟设备告警
  const startWarning = () => {
    models.equipment.children.forEach((mesh: any) => {
      mesh.material = mesh.material.clone()
      mesh.hex = mesh.material.emissive.getHex()
    })

    const handle = () => {
      const currentIndex = random(0, models.equipment.children.length - 1)
      const currentName = models.equipment.children[currentIndex].name
      models.equipment.children.forEach((mesh: any, index: number) => {
        if (index === currentIndex) {
          mesh.material.emissive.setHex(0xff0000)
        } else {
          mesh.material.emissive.setHex(mesh.hex)
        }
      })
      transitionAnimation({
        from: camera.value!.position,
        to: { x: 0.7, y: 2.8, z: 0 },
        duration: 1000 * 2,
        easing: TWEEN.Easing.Linear.None,
        onUpdate(data) {
          camera.value!.position.set(data.x, data.y, data.z)
          ocontrol.value?.update()
        },
      }).start()
    }
    handle()
    warningTimer.value = setInterval(handle, 1000 * 2)
  }

  //结束模拟设备告警
  const stopWarning = () => {
    clearInterval(warningTimer.value)
    models.equipment.children.forEach((mesh: any) => {
      mesh.material.emissive.setHex(mesh.hex)
    })

    transitionAnimation({
      from: camera.value!.position,
      to: { x: 0.5, y: 2.8, z: 0.5 },
      duration: 1000 * 2,
      easing: TWEEN.Easing.Linear.None,
      onUpdate(data) {
        camera.value!.position.set(data.x, data.y, data.z)
        ocontrol.value?.update()
      },
    }).start()
  }

  nextTick(async () => {
    await boostrap()
  })

  return {
    container,
    loading,
    current, 
    startWarning,
    stopWarning,
  }
}

export default useFactory