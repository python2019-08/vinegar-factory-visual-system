import { nextTick, ref, reactive } from 'vue'
import { forEach, random } from 'lodash-es'
import useThree from './useThree'
import TWEEN from 'three/examples/jsm/libs/tween.module.js'
import * as THREE from 'three'
import WidgetLabel from '@/components/WidgetLabel.vue'

const CONFIG = {
  // MODEL_SOURCES: 使用环境变量 VITE_API_DOMAIN 动态拼接模型路径，方便在开发环境和生产环境之间切换。
  MODEL_SOURCES: {
    EQUIPMENT: `${import.meta.env.VITE_API_DOMAIN}/models/equipment.glb`,
    PLANE: `${import.meta.env.VITE_API_DOMAIN}/models/plane.glb`,
    SKELETON: `${import.meta.env.VITE_API_DOMAIN}/models/skeleton.glb`,
  },
  // 
  MODEL_SCALES: [0.0001 * 3, 0.0001 * 3, 0.0001 * 3],

  // EQUIPMENT_POSITION: 这是一个位姿字典。它定义了每个零件（如“变桨系统”）的三种关键坐标：
  // LABEL: 标签应该悬浮在模型上方的哪个位置。
  // COMPOSE: 组装完成后的坐标。
  // DECOMPOSE: 零件散开（爆炸图）时的初始位置。
  EQUIPMENT_POSITION: {
    变桨系统: {
      LABEL: { x: 0.0291, y: 2.6277, z: 0.2308 },
      COMPOSE: { x: 2519.0795, y: 29288.6777, z: 0 },
      DECOMPOSE: { x: 2519.0795, y: 29000.6777, z: 300 },
    },
    转子: {
      LABEL: { x: 0.0632, y: 2.7692, z: 0.1746 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8850, z: 300 },
    },
    主轴: {
      LABEL: { x: 0.0183, y: 2.6193, z: 0.0815 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8350, z: 200 },
    },
    齿轮箱: {
      LABEL: { x: 0.0319, y: 2.6239, z: -0.0402 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8350, z: 100 },
    },
    油冷装置: {
      LABEL: { x: 0.0364, y: 2.7995, z: 0.0593 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8650, z: 600 },
    },
    偏航电机: {
      LABEL: { x: -0.0122, y: 2.75662, z: -0.0305 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8850, z: 400 },
    },
    风冷装置: {
      LABEL: { x: -0.001, y: 2.7643, z: -0.1305 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8750, z: 300 },
    },
    发电机: {
      LABEL: { x: 0.0047, y: 2.6156, z: -0.2045 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8350, z: 0 },
    },
    控制柜: {
      LABEL: { x: 0.0249, y: 2.7605, z: -0.2521 },
      COMPOSE: { x: 20437.7851, y: 8650, z: 0 },
      DECOMPOSE: { x: 20437.7851, y: 8850, z: 0 },
    },
  },
} as const

export function useTurbine() {
  const {
    container,
    scene,
    camera,
    ocontrol,
    outlinePass,
    hexPass,
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
    skeleton: null as any,
  }

  // skeletons: 存放设备的“线框模式”或“骨架模式”，用于在组装动画中产生一种科技感（由虚变实）。
  const skeletons = {
    color: null as any,
    wireframe: null as any,
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

    addModelPick(models.equipment, (intersects) => {
      if (intersects.length > 0) 
      {
        const obj = intersects[0]['object']
        current.value = obj.name
        outlinePass.value!.selectedObjects = [obj]
      } else {
        current.value = ''
        outlinePass.value!.selectedObjects = []
      }
    })

    addModelHoverPick(models.equipment, (intersects) => {
      if (intersects.length > 0) 
      {
        const obj = intersects[0]['object']
        hexPass.value!.selectedObjects = [obj]
      } else {
        hexPass.value!.selectedObjects = []
      }
    })
  }

  //加载机架和设备模型
  const loadModels = async () => {

    const loadEquipment = async () => {
      const gltf = await loadGltf(CONFIG.MODEL_SOURCES.EQUIPMENT)
      const model = gltf.scene
      model.scale.set(...CONFIG.MODEL_SCALES)
      models.equipment = model
      loading.loaded += 1
      model.name = 'equipment'
      scene.value!.add(model)
    }

    const loadSkeleton = async () => {
      const gltf = await loadGltf(CONFIG.MODEL_SOURCES.SKELETON)
      const model = gltf.scene
      loadAnimationMixer(model, gltf.animations, gltf.animations[0].name)
      model.scale.set(...CONFIG.MODEL_SCALES)
      models.skeleton = model
      loading.loaded += 1
      model.name = 'skeleton'
      scene.value!.add(model)

      skeletons.color = models.skeleton.getObjectByName('颜色材质')
      skeletons.wireframe = models.skeleton.getObjectByName('线框材质')
    }

    await Promise.all([loadEquipment(), loadSkeleton()])
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
      const directionalLight = new THREE.DirectionalLight(0xffffff, 5)
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
      
      // 风机白色外壳平面削切动画
      // (2) 外壳削切特效 (视觉核心)
      // 效果描述：这是一种“扫描式”消失效果。skeletons.color（风机的白色实色外壳）通过平面切割，从坐标 4 移动到 2。
      // 时间节奏：持续 4 秒。这是一个较慢的过程，旨在给观众一种揭开面纱的仪式感。
      // 收尾：动画结束后，物理上将 visible 设为 false，彻底释放渲染压力。
      planeClippingAnimation({
        objects: [skeletons.color!],
        from: 4,
        to: 2,
        during: 1000 * 4,
        onComplete() {
          isAnimation.value = false
          skeletons.color!.visible = false
        },
      }).start()

      // 镜头移动
      // (3) 镜头推进 (运镜核心)
      // 运镜轨迹：相机从初始位置（通常是很远的地方）快速拉近到 { x: 0.5, y: 2.8, z: 0.5 }。
      // 缓动函数 (Quintic.InOut)：这是一种极其丝滑的曲线，开始慢，中间快，结尾带一点缓冲。
      // 时间节奏：持续 2 秒。
      transitionAnimation({
        from: camera.value!.position,
        to: { x: 0.5, y: 2.8, z: 0.5 },
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
          isAnimation.value = false
          resolve(void 0)
        },
      }).start()

      //这里的关键技术：并行与异步
      //   与 chain()（串行）不同，这段代码里两个动画是同时 .start() 的：
      //     前 2 秒：镜头在快速移动，同时外壳也在慢慢消失。
      //     第 2 到 4 秒：镜头已经到达预定位置静止，但外壳的削切特效还在继续，直到完全消失。
      //     这种**“长短交织”**的设计非常符合电影运镜逻辑：先定位，再展示细节。
      // 
      //代码细节中的“避坑”点(2/2) :     isAnimation.value 的双重重置:
      //    代码在两个动画的 onComplete 里都写了 isAnimation.value = false。
      //    逻辑陷阱：镜头动画 2 秒就结束了，此时 isAnimation 会变为 false。如果用户在第 3 秒操作鼠标，
      //            会干扰还在进行的 4 秒外壳动画。
      //    建议：最好只在耗时最长的那个动画（即外壳动画）结束时才重置 isAnimation。   
    })
  }

  //设备分解动画: 外壳削切 => 设备分离 => 显示标签/摄像头转动
  // **“设备分解/爆炸图”动画**
  const eqDecomposeAnimation = () => {
    return new Promise((resolve) => {
      //先确保白色外壳隐藏
      skeletons.color.visible = false
      isAnimation.value = true

      // 1. 第一阶段：外壳削切（Clipping Animation）
      // 逻辑：通过平面剪裁（Plane Clipping）效果，让设备的线框外壳（wireframe）产生一种“从有到无”的消失感。
      // 触发：当外壳完全消失后，它会触发 cameraAnimate.start()，让视角开始向预设的侧面位置转动。
      const skeletonAnimate = planeClippingAnimation({
        objects: [skeletons.wireframe],
        from: 4,
        to: 2,
        during: 1000 * 2,
        onComplete: () => {
          skeletons.wireframe.visible = false
          cameraAnimate.start()
        },
      })

      // 2. 第二阶段：零件分离（Explosion/Decompose）
      //可以每个部件创建一个动画，这里为了更好控制进程避免使用settimeout，只使用一个动画(更麻烦)
      const from: any = {}
      const to: any = {}
      
      // 数据构造：代码通过遍历 models.equipment.children，将几十个零件的当前位置（COMPOSE）
      //         存入 from，目标分散位置（DECOMPOSE）存入 to。
      forEach(models.equipment.children, (mesh, index) => {
        const name = mesh.name as keyof typeof CONFIG.EQUIPMENT_POSITION
        const decompose = CONFIG.EQUIPMENT_POSITION[name]['DECOMPOSE']
        const compose = CONFIG.EQUIPMENT_POSITION[name]['COMPOSE']
        // 起点：组装位 (compose) -> 终点：分解位 (decompose)
        from[`x${index}`] = compose.x
        from[`y${index}`] = compose.y
        from[`z${index}`] = compose.z
        to[`x${index}`] = decompose.x
        to[`y${index}`] = decompose.y
        to[`z${index}`] = decompose.z
      })

      // 统一动画：“不使用 setTimeout，只用一个动画”。这是一个高明的做法：
      // 原因：如果有 50 个零件，开启 50 个 TWEEN 对象会造成内存压力且难以同步。
      // 实现：在一个 transitionAnimation 的 onUpdate 钩子中，根据当前的 data 
      //      统一设置所有零件的 position。这保证了所有零件的爆炸动作是完全同步的。      
      const eqAnimate = transitionAnimation({
        from,
        to,
        duration: 1000 * 2,
        easing: TWEEN.Easing.Quintic.InOut,
        onUpdate(data) {
          forEach(models.equipment.children, (mesh, index) => {
            mesh.position.set(
              data[`x${index}`],
              data[`y${index}`],
              data[`z${index}`]
            )
          })
        },
        onComplete: () => {
          isAnimation.value = false
          createEquipmentLabel()
          resolve(void 0)
        },
      })

      // 3. 第三阶段：相机转动与标签呈现
      // 视角切换：在零件散开的同时，相机缓慢平移到一个可以看清内部结构的侧方位。
      // 最后收尾：在 eqAnimate 的 onComplete 钩子中：
      //      isAnimation.value = false（恢复用户交互）。
      //      createEquipmentLabel()：在零件散开后的最终位置上，生成我们之前讨论过的 Vue CSS2D 标签。
      //      resolve(void 0)：告诉外部 Promise，整个分解序列已完成。      
      const cameraAnimate = transitionAnimation({
        from: camera.value!.position,
        to: { x: 0.7, y: 2.8, z: 0 },
        duration: 1000 * 2,
        easing: TWEEN.Easing.Linear.None,
        onUpdate(data) {
          // 
          camera.value!.position.set(data.x, data.y, data.z)
          // ocontrol.value?.update() 的必要性：
          //    如果你手动修改了相机的 position，但没有更新 OrbitControls，
          //    那么当你下次用鼠标拖拽时，相机会瞬间“跳回”原来的位置。
          ocontrol.value?.update()
        },
      })

      // 关键语法技巧：.chain()
      // 这是 TWEEN.js 的精髓。它将两个独立的动画串联起来：
      //      先运行 skeletonAnimate（切开外壳）。
      //      外壳动画结束后，自动启动 eqAnimate（零件散开）。
      //      这比使用回调函数或者 async/await 更加直观且节省性能。      
      skeletonAnimate.chain(eqAnimate).start()
    })
  }

  //设备组合动画: 隐藏标签 => 设备组合 => 外壳还原
  const eqComposeAnimation = () => {
    return new Promise((resolve) => {
      //---- 第一步：清理阶段 ----
      // 设置 isAnimation.value = true（防止用户在动画过程中进行其他操作）。
      isAnimation.value = true
      // 执行 removeEquipmentLabel()：组装时，标签会遮挡视线，必须先移除。
      removeEquipmentLabel()

      //---- 第二步：相机跟随 ----
      // 镜头移动
      // 使用 transitionAnimation 让相机飞向 { x: 0.5, y: 2.8, z: 0.5 }。这是一个定点观察位。
      const cameraAnimate = transitionAnimation({
        from: camera.value!.position,
        to: { x: 0.5, y: 2.8, z: 0.5 },
        duration: 1000 * 2,
        easing: TWEEN.Easing.Linear.None,
        onUpdate(data) {
          camera.value!.position.set(data.x, data.y, data.z)
          ocontrol.value?.update()
        },
      })
      cameraAnimate.start()

      //---- 第三步：零件合体 (核心逻辑) ----
      // 设备组合动画
      const from: any = {}
      const to: any = {}
      // 代码遍历了 models.equipment.children。
      forEach(models.equipment.children, (mesh, index) => {
        // 动态构建数据：它把每个零件的起始坐标（DECOMPOSE）和终点坐标（COMPOSE）拼成了一个巨大的 from 和 to 对象。
        const name = mesh.name as keyof typeof CONFIG.EQUIPMENT_POSITION
        const decompose = CONFIG.EQUIPMENT_POSITION[name]['DECOMPOSE']
        const compose = CONFIG.EQUIPMENT_POSITION[name]['COMPOSE']
        from[`x${index}`] = decompose.x
        from[`y${index}`] = decompose.y
        from[`z${index}`] = decompose.z
        to[`x${index}`] = compose.x
        to[`y${index}`] = compose.y
        to[`z${index}`] = compose.z
      })

      const eqAnimate = transitionAnimation({
        from,
        to,
        duration: 1000 * 2,
        easing: TWEEN.Easing.Quintic.InOut,
        // 批量更新：在 onUpdate 钩子中，根据 TWEEN 算出的比例，同时移动这几十甚至上百个零件。
        onUpdate(data) {
          forEach(models.equipment.children, (mesh, index) => {
            mesh.position.set(
              data[`x${index}`],
              data[`y${index}`],
              data[`z${index}`]
            )
          })
        },
      })
      skeletons.wireframe.visible = true
      const skeletonAnimate = planeClippingAnimation({
        objects: [skeletons.wireframe],
        from: 2,
        to: 4,
        during: 1000 * 2,
        onComplete: () => {
          isAnimation.value = false
          resolve(void 0)
        },
      })
      //---- 第四步：动画链 (chain) ----
      // eqAnimate.chain(skeletonAnimate)：这表示“当零件全部飞到位后，立即开始执行骨架的平面切割动画（出现特效）”。
      // 当这一切结束时，执行 resolve(void 0)，告诉外部：组装完毕！
      eqAnimate.chain(skeletonAnimate).start()
    })
  }

  //生成设备标签
  const createEquipmentLabel = () => {
    forEach(CONFIG.EQUIPMENT_POSITION, (point, name) => {
      // 遍历配置表，调用  loadCSS2DByVue。
      const label = loadCSS2DByVue(WidgetLabel, { name })
      // 每个标签都被赋予了配置文件中预设的 LABEL 坐标。
      label.position.set(point.LABEL.x, point.LABEL.y, point.LABEL.z)

      labelGroup.add(label)
    })
    scene.value!.add(labelGroup)
  }

  //移除设备标签
  const removeEquipmentLabel = () => {
    while (labelGroup.children.length > 0) 
    {
      const child: any = labelGroup.children[0]
      labelGroup.remove(child) //

      // 防内存泄漏：这是最值得点赞的地方。在 Three.js 中，直接 remove 一个物体并不会释放显存。
      // 通过手动执行 .dispose()，你确保了显卡内存被正确清理，这对于需要长时间运行的监控大屏
      // 来说至关重要，否则网页开几天就会崩溃。      
      child.geometry && child.geometry.dispose() // 释放几何体资源
      child.material && child.material.dispose() // 释放材质资源
    }
    scene.value!.remove(labelGroup)
    // ⚠️ 潜在的一个小问题
    // 在 removeEquipmentLabel 中，你使用了 while (labelGroup.children.length > 0)。
    // 风险：由于 CSS2D 标签本质上是 HTML 元素，geometry.dispose() 对它其实没用（因为它没有几何体）。
    // 建议：对于 CSS2DObject，除了 remove，你可能还需要手动从 DOM 中移除其关联的 element，以确保万无一失。

  }

  /**
// gemini.google:
// labelGroup.remove(child) // 断开 3D 对象的父子连接
// scene.value!.remove(labelGroup) // 断开 组 与 场景 的连接
// 这两行代码确实实现了逻辑上的移除，但对于 CSS2DObject 这种特殊对象，它们并没有清理掉它对应的 HTML 节点。
// 建议将 removeEquipmentLabel 修改为：
const removeEquipmentLabel = () => {
  while (labelGroup.children.length > 0) {
    const child = labelGroup.children[0] as any; // 这里的 child 是 CSS2DObject

    // 1. 核心步骤：从浏览器的 DOM 树中彻底移除 HTML 元素
    if (child.element && child.element.parentNode) {
      child.element.parentNode.removeChild(child.element);
    }

    // 2. 从 Three.js 的组中移除对象
    labelGroup.remove(child);

    // 3. 释放资源（虽然 CSS2D 没有 geometry，但写着是个好习惯，兼容其他 Mesh）
    child.geometry && child.geometry.dispose();
    child.material && child.material.dispose();
  }
  
  scene.value!.remove(labelGroup);
};    
   */


  const warningTimer = ref()

  //开始模拟设备告警
  // 随机让场景里的一个零件变成红色（代表告警），同时自动把镜头切过去“聚焦”观察。
  const startWarning = () => {
    // (1) 初始化：材质备份
    // 这步在 addHexEffect 里见过。它确保每个零件都有自己独立的材质，
    // 并记住了自己“健康”时的颜色（通常是灰色或金属色），以便稍后恢复。
    models.equipment.children.forEach((mesh: any) => {
      // 克隆材质，防止改一个全变红
      mesh.material = mesh.material.clone()
      // 备份原始颜色
      mesh.hex = mesh.material.emissive.getHex()
    })

    // (2) 告警触发器 (handle 函数)
    const handle = () => {
      // 随机选点：通过 random 随机选中一个零件的索引（currentIndex）。
      const currentIndex = random(0, models.equipment.children.length - 1)
      const currentName = models.equipment.children[currentIndex].name
      // 视觉反馈：
      // 被抽中的“倒霉蛋”：材质的自发光（emissive）设为红色 (0xff0000)。
      // 其他的“幸运儿”：恢复为备份的原始颜色 mesh.hex。
      models.equipment.children.forEach((mesh: any, index: number) => {
        if (index === currentIndex) {
          mesh.material.emissive.setHex(0xff0000)
        } else {
          mesh.material.emissive.setHex(mesh.hex)
        }
      })

      // 自动运镜：
      // 调用 transitionAnimation 让相机飞向 { x: 0.7, y: 2.8, z: 0 }。
      // 注意：这里目前是飞向一个固定位置。在实际业务中，通常会改为飞向 currentIndex 那个零件的坐标。
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
    // (3) 循环定时任务
    // 使用 setInterval 每 2 秒更换一个告警目标，模拟设备不断产生随机故障的动态效果。
    warningTimer.value = setInterval(handle, 1000 * 2)
    
    // ⚠️ 潜在的隐患 
    // 相机冲突：如果 handle 是每 2 秒执行一次，而 transitionAnimation 也要跑 2 秒，
    //         那么相机会一直在飞，完全停不下来。如果用户尝试用鼠标控制相机，会产生强烈的“拉扯感”。
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
    eqDecomposeAnimation,
    eqComposeAnimation,
    startWarning,
    stopWarning,
  }
}

export default useTurbine
