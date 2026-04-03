import {
  ref,
  shallowRef,
  nextTick,
  onUnmounted,
  defineComponent,
  createVNode,
  render,
  h,
} from 'vue'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { isFunction } from 'lodash-es'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
// import TWEEN from '@tweenjs/tween.js'
import TWEEN from 'three/examples/jsm/libs/tween.module.js'
import * as THREE from 'three'

//基础配置 用于快速的初始化参数修改
const CONFIG = {
  CAMERA_POSITION: [0.2, 1.0, 0.4],
  CONTROL_TARGET: [0, 1.1, 0],
  DECODER_PATH: `${import.meta.env.VITE_API_DOMAIN}/js/draco/gltf/`,
} as const

export function useThree() {
  const container = ref<HTMLElement>() //挂载的容器
  const scene = shallowRef<THREE.Scene>() //场景
  const camera = shallowRef<THREE.PerspectiveCamera>() //相机
  const renderer = shallowRef<THREE.WebGLRenderer>() //渲染器
  const cssRenderer = shallowRef<CSS2DRenderer>() //css2d渲染器
  const ocontrol = shallowRef<OrbitControls>() //轨道控制器
  const tcontrol = shallowRef<TransformControls>() //变换控制器
  const outlinePass = shallowRef<OutlinePass>() //outlinePass
  const hexPass = shallowRef()
  const composers = new Map() //后期处理
  const mixers: any = [] //动画混合器
  const clock = new THREE.Clock() //时钟
  const renderMixins = new Map() //渲染混合器
  const dracoLoader = new DRACOLoader() //draco加载器
  dracoLoader.setDecoderPath(CONFIG.DECODER_PATH)
  dracoLoader.setDecoderConfig({ type: 'js' })

  const boostrap = () => {
    boostrapScene()
    boostrapCamera()
    boostrapRenderer()
    boostrapControls()
    boostrapLights()
    onAnimate()
    onWindowResize()
    addOutlineEffect()
    addHexEffect()
  }

  // ---------------------------------------------------------------
  //Scene
  const boostrapScene = () => {
    scene.value = new THREE.Scene()
  }
  //Camera
  const boostrapCamera = () => {
    const { clientWidth, clientHeight } = container.value!

    camera.value = new THREE.PerspectiveCamera(
      45,
      clientWidth / clientHeight,
      0.1,
      10000
    )
    camera.value.position.set(...CONFIG.CAMERA_POSITION)
  }
  //Renderer
  // 初始化两个并行的渲染引擎：一个是处理 3D 模型的 WebGLRenderer，
  //                     另一个是处理 HTML 标签（如房间名、设备提示框）的 CSS2DRenderer。
  const boostrapRenderer = () => {
    // 获取宿主 DOM 元素（通常是一个 div）的宽高，确保渲染出的画面能填满这个区域。
    const { clientWidth, clientHeight } = container.value!
    //Renderer
    // 核心 3D 渲染器（WebGLRenderer）： 这是负责绘制“醋厂”厂房、坛子和光影的核心引擎。
    // 
    // antialias: true: 开启抗锯齿。让坛子边缘和厂房线条看起来更平滑，不跳动（Web 端开发必开）。
    // alpha: true: 允许背景透明。配合下文的 setClearAlpha(0.5)，你可以看到 3D 场景背后的网页背景。
    renderer.value = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.value.setPixelRatio(window.devicePixelRatio);
    // shadowMap.enabled = false: 关闭阴影计算。
    // localClippingEnabled = true: 开启局部剖切。这在 BIM 或工业可视化中非常有用，
    //    比如你可以用一个“剖切面”把厂房切开，观察内部坛子的排布。
    renderer.value.shadowMap.enabled = false
    // 在 Three.js 较新版本中，这行已经改名为 renderer.outputColorSpace = THREE.SRGBColorSpace。
    // 建议开启它：开启后，你从 Blender 导出的颜色和光照在网页里看起来会更自然，不至于显得灰蒙蒙的。
    // 
    // renderer.value.outputEncoding = THREE.sRGBEncoding
    // 
    renderer.value.setSize(clientWidth, clientHeight)
    renderer.value.localClippingEnabled = true
    // setClearAlpha(0.5): 设置画布的初始透明度为 0.5。
    renderer.value.setClearAlpha(0.5)
    renderer.value.domElement.className = 'webgl-renderer'
    // appendChild(...): 将生成的 <canvas> 标签插入到页面中。
    container.value!.appendChild(renderer.value.domElement)


    //CssRenderer（2D 标签渲染器）
    // 在数字孪生项目中，我们经常需要在 3D 物体上方显示“文字标签”（比如：1号发酵池）。
    // 如果用 3D 建模画文字会很重，所以 Three.js 提供了这个工具，让你用 HTML/CSS 来写标签。    
    cssRenderer.value = new CSS2DRenderer()
    // setSize(...): 必须与 WebGL 渲染器尺寸完全一致，这样标签才能精准对齐模型。
    cssRenderer.value.setSize(clientWidth, clientHeight)
    cssRenderer.value.domElement.className = 'css2d-renderer'
    // style.position = 'absolute': 将标签层绝对定位，覆盖在 3D 画布上方。
    cssRenderer.value.domElement.style.position = 'absolute'
    cssRenderer.value.domElement.style.top = '0px'
    // style.pointerEvents = 'none': 非常关键！
    // 它的意思是“穿透”这一层。因为 2D 渲染器是一个全屏的透明层，如果不设置这一行，你的鼠标点击
    //    操作会被这层挡住，导致你无法用 OrbitControls 旋转 3D 场景。
    cssRenderer.value.domElement.style.pointerEvents = 'none'
    // appendChild(...): 将 2D 渲染层的 DOM 插入到容器中。
    container.value!.appendChild(cssRenderer.value.domElement)
    // ---------------------------------------------------------------
    // (1)层级顺序： 代码中先 appendChild 了 WebGL，后 appendChild 了 CSS2D。这意味着 
    //     CSS2D 始终在 WebGL 上方。这是正确的，否则你的文字标签会被墙体遮挡（或者根本看不见）。
    // (2)由于你现在有两个渲染器，在你的 animate 或 render 函数里，必须同时更新它们：
    //    function animate() {
    //      requestAnimationFrame(animate);

    //      // 更新 3D 画面
    //      renderer.value.render(scene, camera);

    //      // 更新 2D 标签位置
    //      cssRenderer.value.render(scene, camera);
    //    }
  }


  //Controls
  // 初始化并配置 Three.js 中最常用的 OrbitControls（轨道控制器）。
  // 它的作用是让用户可以通过鼠标或触摸屏来旋转、缩放和平移场景中的摄像机。
  const boostrapControls = () => {
    // 作用：创建一个新的轨道控制器实例。
    // 参数：它需要接收摄像机（决定看哪里）和渲染器的 DOM 元素（用于监听鼠标/触摸事件，通常是 <canvas>）。
    ocontrol.value = new OrbitControls(
      camera.value!,
      renderer.value!.domElement
    )

    // 
    ocontrol.value.minPolarAngle = 0
    // 阻尼/惯性设置（让操作更丝滑）。
    // 
    // enableDamping：开启阻尼（惯性）。当你松开鼠标时，摄像机不会立刻停止，而是会有一个平滑的减速过程。
    ocontrol.value.enableDamping = true
    // dampingFactor：阻尼系数。数值越小，停下来的过程越慢，感觉越“滑”。
    // 关于动画循环：开启了 enableDamping 后，你必须在 requestAnimationFrame 的渲染循环函数里
    //            不断调用 ocontrol.value.update()，否则惯性效果不会出现。
    ocontrol.value.dampingFactor = 0.1
    // 观察目标点（Target）
    // 
    // 作用：设置相机旋转的中心点。默认值为坐标原点 $(0, 0, 0)。
    ocontrol.value.target.set(0, 2.65, 0)
    // 垂直旋转角度限制（极角限制）
    // PolarAngle：指相机相对于垂直正上方（Y轴）的角度。
    // 
    // 限制范围：
    // 90度：相机最低只能降到地平线水平位置（不能钻到地板下面去）。
    // 45度：相机最高只能俯视到 45 度角（不能直接移动到物体正上方俯视）。    
    ocontrol.value.maxPolarAngle = THREE.MathUtils.degToRad(90) // 最大夹角 60 度
    ocontrol.value.minPolarAngle = THREE.MathUtils.degToRad(45) // 最小夹角 0 度
    // 缩放距离限制
    // 作用：限制用户使用滚轮缩放的距离。
    // 意义：
    //    minDistance = 0.5：防止镜头靠得太近，钻进坛子或墙体内部。
    //    maxDistance = 2：防止镜头拉得太远，导致整个厂房看不见。
    // 结合你的尺寸：你的坛子约 1 米宽，设置 2 米的最大距离意味着用户只能在坛子附近观察，无法看到很大的全景。 
    // 建议根据厂房实际大小（比如 20 米宽）将 maxDistance 调大到 20 - 30 左右。  
    ocontrol.value.minDistance = 0.5
    ocontrol.value.maxDistance = 2
    // 作用：手动更新控制器的矩阵。当你手动修改了 target 或控制器的其他参数后，必须调用此方法使更改生效。
    ocontrol.value.update()

    // ocontrol.value.addEventListener('change', animate)
    // tcontrol.value = new TransformControls(
    //   camera.value,
    //   renderer.value!.domElement
    // )
    // tcontrol.value.addEventListener('change', animate)
    // tcontrol.value.addEventListener('dragging-changed', (event: any) => {
    //   ocontrol.value.enabled = !event.value
    // })
  }


  // ---------------------------------------------------------------
  //Lights
  const boostrapLights = () => {
    // 环境光 (AmbientLight)
    // 作用：提供均匀的、无处不在的基础亮度。它没有方向，不会产生阴影。
    // 参数：颜色为灰色 0x999999，强度为 10。
    // 项目分析：强度 10 在 Three.js 新版本中是一个非常高的数值（通常为 0.5-2）。
    //     这说明你的模型材质可能没有自发光，或者你希望整个厂房内部即使没有阳光直射的地方
    //     也看起来非常明亮，避免出现纯黑的死角。
    const ambientLight = new THREE.AmbientLight(0x999999, 1.5)
    scene.value!.add(ambientLight)


    // 平行光 (DirectionalLight):
    // 作用：模拟太阳光。射线是平行的，可以产生明确的明暗面和阴影。
    // 参数：纯白色 0xffffff，强度 0.5（相比环境光，它主要负责提供立体感）。
    // 位置：设置在坐标 $(20, 20, 20)$，即从场景的右上方斜着射向中心。    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(20, 20, 20)
    directionalLight.position.multiplyScalar(1)
    // castShadow = true：开启这盏灯的阴影投影功能。
    directionalLight.castShadow = true
    // mapSize：设置阴影贴图的分辨率为 $1024 \times 1024$。数值越高，阴影边缘越清晰；数值越低，阴影越模糊或带有锯齿。
    directionalLight.shadow.mapSize = new THREE.Vector2(1024, 1024)
    // scene.value.add(new THREE.DirectionalLightHelper(directionalLight, 5))
    // ---- 手动设置阴影相机的范围：
    // directionalLight.shadow.camera.left = -50;
    // directionalLight.shadow.camera.right = 50;
    // directionalLight.shadow.camera.top = 50;
    // directionalLight.shadow.camera.bottom = -50;    
    scene.value!.add(directionalLight)
  }

  //窗口大小变化时重新设置渲染器大小
  const onWindowResize = () => 
  {
    const handleResize = () => {
      const { clientWidth, clientHeight } = container.value!
      camera.value!.aspect = clientWidth / clientHeight
      camera.value!.updateProjectionMatrix()

      renderer.value!.setSize(clientWidth, clientHeight)
      cssRenderer.value!.setSize(clientWidth, clientHeight)
      ocontrol.value!.update()
    }

    window.addEventListener('resize', handleResize)

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })
  }

  // 渲染循环:
  // 这段代码是整个 3D 程序的心脏，也就是所谓的渲染循环（Render Loop）。它的作用是
  // 让画面以每秒 60 帧（60 FPS）的速度不断刷新，并处理动画、特效和 2D 标签的同步。
  const onAnimate = () => {
    // 作用：获取两次渲染之间的时间差（通常是 16.6 毫秒左右）。
    // 意义：这确保了动画在不同性能的电脑上运行速度是一致的。 
    const delta = clock.getDelta()

    // --- 第一步：更新所有数据（状态改变） ---
    // 补间动画更新 (TWEEN)
    // 作用：处理平滑的数值过渡。
    // 场景应用：通常用于相机的平滑飞行。比如你点击侧边栏的“3号发酵区”，相机从当前位置
    //         丝滑地飞过去，这就是 TWEEN 在每一帧计算相机的位置坐标。
    TWEEN.update()    
    // 处理模型动画 (Animation Mixers)
    // 场景应用：如果你的“醋厂”里有正在旋转的搅拌机、自动移动的传送带，或者工厂大门的开关动画，
    //         这些动画都存储在 mixers（动画混合器）中。这一步是驱动这些模型动画向前播放。
    mixers.forEach((mixer: any) => mixer.update(delta))    
    // 自定义逻辑插件 (Render Mixins)
    // 作用：这是一个钩子函数队列。
    // 意义：如果你想在每一帧执行一些额外逻辑（比如实时更新某个坛子的旋转、检测相机位置等），
    //      你可以把这些函数丢进 renderMixins 数组里，而不需要修改核心循环代码。
    renderMixins.forEach((mixin) => isFunction(mixin) && mixin())

    // --- 第二步：执行渲染（画面呈现） ---
    if (composers.size > 0) {// 1. 如果有后期处理队列，只执行 composer
        // 后期处理特效 (Composers)
        // 作用：处理“后期滤镜”。
        // 典型应用：如果你想给选中的坛子加一个外轮廓发光（OutlinePass），或者给整个厂房加一个辉光（Bloom），
        //         这些都是在 composer 里完成的。它会覆盖掉上面标准的 renderer.render 效果。          
        composers.forEach((composer) => composer.render(delta));
    } else {// 2. 如果没有特效，才执行常规WebGL渲染，节省性能
        // 执行WebGL渲染作用：让显卡根据当前的相机视角，把 3D 场景画到屏幕上。
        renderer.value!.render(scene.value!, camera.value!);

        console.log( "render.calls=",renderer.value!.info.render.calls)
    }

    // --- 第三步：同步 UI 层 ---
    // 同步 2D 标签 (CSS2DRenderer)
    // 作用：让 HTML 标签（CSS2D 对象）的位置跟随 3D 模型一起移动。如果没有这一行，
    //      当你旋转场景时，坛子动了，但它头顶的文字标签会停在原地。
    cssRenderer.value!.render(scene.value!, camera.value!)
    

    // 递归调用 (RequestAnimationFrame)
    // 作用：告诉浏览器，在下次重绘之前再次执行 onAnimate。这是实现动画最科学的方法，
    //      它会自动匹配显示器的刷新率，并在标签页隐藏时自动暂停以节省电量。
    requestAnimationFrame(() => onAnimate())
  }

  // 将返回类型改为 Promise<THREE.DataTexture>
  const loadBgEnv = (url: string): Promise<THREE.DataTexture> => {
    const rgbeLoader = new RGBELoader()
    
    return new Promise((resolve, reject) => {
      rgbeLoader.load(  url, (texture) => {
          // 设置映射模式，确保光照计算正确
          texture.mapping = THREE.EquirectangularReflectionMapping;
          
          if (scene.value) {
            scene.value.environment = texture; 
            scene.value.background = texture;
            // 进阶操作：如果你觉得日落太暗了，可以调整贴图的曝光
            // 注意：这会影响所有引用 scene.environment 的物体（如工字钢、玻璃）
            texture.colorSpace = THREE.LinearSRGBColorSpace; // 确保颜色空间正确            
          }

          // 成功后，将 texture 对象返回出去
          resolve(texture);
        },
        // 进度回调（可选）
        undefined,
        // 错误处理
        (error) => {
          console.error('加载环境贴图出错:', error);
          reject(error);
        }
      )
    })
  }

  // 初始化实例化网格的颜色，为 InstancedMesh.setColorAt(instanceId, highlightColor)做准备
  const  initInstancedMeshColor=(obj: THREE.Object3D) :void => {
    // 假设 obj 是加载进来的 InstancedMesh
    if (obj.isInstancedMesh && !obj.instanceColor) {
      const count = obj.count; // 罐子总数 (例如 100)
      const colors = new Float32Array(count * 3); // 每个实例 RGB 3个分量
      
      // 填充默认颜色（比如白色 1, 1, 1）
      for (let i = 0; i < count; i++) {
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      }
      
      // 创建 InstancedBufferAttribute
      obj.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
  }

  //加载 GLTF/GLB 模型
  const loadGltf = (url: string): Promise<GLTF> => {
    // GLTFLoader: Three.js 官方用于加载 .gltf 或 .glb 文件的工具。
    const loader = new GLTFLoader()
    // setDRACOLoader: 这是针对你之前提到的体积优化的关键。它告诉加载器：如果模型是用 Draco 算法
    //           压缩过的（比如你那个 169KB 的版本），请使用 dracoLoader 插件进行解压。
    loader.setDRACOLoader(dracoLoader)

    const onCompleted = (object: GLTF, resolve: any) => resolve(object)
    // Promise: 将异步操作包裹起来。只有当模型文件从服务器彻底下载并解析完成后，才会执行 resolve。
    // url: 你的模型文件路径（例如 /models/vinegar_factory.glb）。
    // 
    // 执行 new Promise((resolve, reject) => { ... }) 时，Promise 的构造函数内部会自动生成两个函数：
    // (1)resolve 成功时的通行证;(1)reject 失败时的报警器。
    // 这两个函数会作为参数传递给你写的匿名函数.
    // 
    // resolve 的使命是：
    // (1)切换状态：改变 Promise 的状态。
    //         Promise 初始化时是 pending（等待中）。一旦你执行了 resolve(object)，状态立刻变为 fulfilled（已成功）。
    // (2)传递数据：把结果“发射”出去。
    //         把加载好的模型 object 塞进 resolve() 的括号里，这个模型就会被传递给外部的 .then() 或 await 语句。
    return new Promise<GLTF>((resolve, reject) => {
      loader.load( url, (object: GLTF) => {
          object.scene.traverse((child) => {
            // 初始化实例化网格的颜色
            initInstancedMeshColor(child)
            
            
            // 使用 child.isMesh 确保它是网格物体
            if ((child as THREE.Mesh).isMesh && child.name.includes('_semitransparent')) {
              const mesh = child as THREE.Mesh;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              // console.log("child.name="+child.name)
              // console.log("mesh.name="+mesh.name)
              // 1. 克隆材质，防止影响到共享该材质的其他非玻璃物体
              mesh.material = mat.clone();
              const newMat = mesh.material as THREE.MeshStandardMaterial;

              // 2. 开启透明属性
              newMat.transparent = true;
              newMat.opacity = 0.5;
              newMat.metalness = 0.1;
              newMat.roughness = 0.05;

              // 3. 关键：关闭深度写入，让玻璃后面的罐子能显示出来
              newMat.depthWrite = false;

              // 4. 可选：如果厂房有内外两面，开启双面渲染
              newMat.side = THREE.DoubleSide;
            }
          });
           
          resolve(object);
        },
        // 进度回调 (可选)
        (xhr) => { console.log((xhr.loaded / xhr.total * 100) + '% loaded'); },
        // 错误处理 (必须，防止加载失败时 Promise 一直处于 pending 状态)
        (error) => {
          console.error('加载模型出错:', error);
          reject(error);
        }
      );
    });
  }

  //加载动画混合器(用于启动模型自带的动画)
  const loadAnimationMixer = (
    mesh: THREE.Mesh | THREE.AnimationObjectGroup | THREE.Group,// 要动的模型/模型组
    animations: Array<THREE.AnimationClip>,// 模型里所有的动画列表
    animationName: string // 你想播放哪一个动画（按名字找）
  ) => {
    // 1. 创建动画控制器 → 专门控制这个模型的动作
    const mixer = new THREE.AnimationMixer(mesh)
    // 2. 从动画列表里，根据名字找到你要播的动画
    const clip = THREE.AnimationClip.findByName(animations, animationName)
    if (!clip) // 3. 如果找不到这个动画 → 直接退出
      return undefined
    
    // 4. 给动画控制器分配这个动画
    const action = mixer.clipAction(clip)
    // 5. 立刻播放！
    action.play()
    // 6. 把控制器放进数组，让渲染循环每帧更新动画（必须做，否则不动）
    mixers.push(mixer)
    return undefined
  }

  //加载坐标轴:在 3D 场景中添加一个可视化坐标轴辅助器
  const loadAxesHelper = () => {
    // 作用：创建一个由红、绿、蓝三条线组成的坐标轴。
    // 红色 (Red) 代表 X 轴。
    // 绿色 (Green) 代表 Y 轴（在 Three.js 中通常是向上的方向）。
    // 蓝色 (Blue) 代表 Z 轴。
    // 
    // 参数 5000：表示坐标轴线条的长度。
    const axesHelper = new THREE.AxesHelper(5000)
    scene.value!.add(axesHelper)
  }


  //通过vue文件加载CSS2D
  // 把Vue3的组件（.vue文件）转换成Three.js可以使用的 CSS2DObject（3D场景中的HTML标签）.

  const loadCSS2DByVue = (component: any, props: Record<string, any>) => {
    const crender = (component: any, props: Record<string, any>) => {
      // defineComponent & h: 接收你传进来的 Vue 组件和属性（props），手动创建一个虚拟节点。
      const newComponent = defineComponent({
        render: () => h(component, props),
      })
      // createVNode: 类似于在内存中“预加载”这个组件。
      const instance = createVNode(newComponent)
      // render: 这是 Vue3 底层的渲染函数。它把虚拟组件真正地渲染出来，并挂载到一个临时的 div 中。
      render(instance, document.createElement('div'))
      // instance.el: 渲染完成后，拿到这个组件生成的真实 HTML 元素。
      return instance.el
    }
    const element = crender(component, props) as HTMLElement
    // 封装为 Three.js 对象
    // CSS2DObject: 这是 Three.js 的扩展类。它把刚才那个 Vue 生成的 HTML 元素包裹起来，
    //              赋予它 3D 空间坐标属性（.position）。
    const css2dObject = new CSS2DObject(element)
    return css2dObject
  }

  // 加载测试场景
  const loadTestScene = () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const cube = new THREE.Mesh(geometry, material)
    scene.value!.add(cube)
  }

  //过渡动画:
  //     这段代码是对 TWEEN.js 库的一个高级封装函数。它的作用是让两个数值（或对象）
  // 之间产生平滑的过渡效果，而不是瞬间跳变。
  const transitionAnimation = (props: {
    // Record<K, T>：创建一个对象类型，属性键为 K，属性值为 T  
    from: Record<string, any> 
    to: Record<string, any>
    duration: number
    easing?: any
    onUpdate?: (params: Record<string, any>) => void
    onComplete?: (params: Record<string, any>) => void
  }) => {
    // 解构赋值：从传入的对象中提取参数，如果没有传 easing，则赋予一个默认的平滑曲线。
    const {
      from,
      to,
      duration,
      easing = TWEEN.Easing.Quadratic.Out,
      onUpdate,
      onComplete,
    } = props

    // 创建 Tween 实例：
    //     告诉 TWEEN：请把 from 对象里的数值，在 duration 时间内，变成 to 对象里的数值。
    return new TWEEN.Tween(from)
      .to(to, duration)
      .easing(easing)
      // 绑定生命周期钩子：.onUpdate 在动画跑的过程中，每一帧都会把当前的中间值传给 onUpdate。
      .onUpdate((object: any) => isFunction(onUpdate) && onUpdate(object))
      // 绑定生命周期钩子：.onComplete 动画跑完的那一刻触发。
      .onComplete((object: any) => isFunction(onComplete) && onComplete(object))
  }

  //平面削切动画
  const planeClippingAnimation = (config: {
    objects: Array<THREE.Object3D> // 被削切的对象
    from: number // 初始高度
    to: number // 目标高度
    during?: number // 动画时长
    easing?: any // 动画缓动函数
    onComplete?: () => void // 动画完成回调即达到target高度
  }) => {
    const { objects, during, easing, from, to, onComplete } = config

    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), from)
    objects.forEach((object) => {
      object?.traverse((mesh: any) => {
        if (!(mesh instanceof THREE.Mesh)) return void 0
        mesh.material.clippingPlanes = [clippingPlane]
      })
    })

    return transitionAnimation({
      from: { constant: from },
      to: { constant: to },
      duration: during ?? 1000,
      easing: easing ?? TWEEN.Easing.Quadratic.Out,
      onUpdate: (object: any) => {
        clippingPlane.constant = object.constant
      },
      onComplete: () => {
        isFunction(onComplete) && onComplete()
      },
    })
  }

  //添加outline效果
  //     场景初始化 OutlinePass（外轮廓发光特效）。在工业数字孪生中，这通常用于
  // "选中交互"：当你点击某个物体时，它会发出一圈高亮的边框，告诉用户“你选中了这一组”。
  const addOutlineEffect = (config?: {
    edgeStrength?: number
    edgeGlow?: number
    edgeThickness?: number
    pulsePeriod?: number
    usePatternTexture?: boolean
    visibleEdgeColor?: string | number
    hiddenEdgeColor?: string | number
  }) => {
    // 1.初始化后期处理管线 (EffectComposer)
    // 
    // EffectComposer: 后期处理的总管理器。它会接管原生的渲染流程。
    const composer = new EffectComposer(renderer.value!)
    // RenderPass: 第一道工序。它负责把场景的基础画面画出来，作为后续特效的“底图”。
    const renderPass = new RenderPass(scene.value!, camera.value!)
    composer.addPass(renderPass)
 

    // 2.配置 OutlinePass (核心特效)
    // 这里创建了轮廓提取器。它需要知道当前的屏幕尺寸、场景和相机，以便计算哪些物体的边缘需要勾勒。
    outlinePass.value = new OutlinePass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      scene.value!,
      camera.value!
    )

    // 3.参数配置与合并 (Default vs Custom)
    const deafultConfig = {
      // edgeStrength (边缘强度)：轮廓有多亮。
      edgeStrength: 3,
      // 
      edgeGlow: 0,
      // edgeThickness (边缘厚度)：线条有多粗。
      edgeThickness: 1,
      // pulsePeriod (呼吸频率)：如果设置大于 0，轮廓会像呼吸灯一样忽明忽暗。
      pulsePeriod: 0,
      usePatternTexture: false,
      // visibleEdgeColor: 被挡住部分（可见部分）的颜色。
      visibleEdgeColor: '#fff',
      // hiddenEdgeColor: 被其他物体挡住部分的轮廓颜色（通常设为一致）。
      hiddenEdgeColor: '#fff',
    }
    // 这里使用了 Object.assign。它的意思是：如果调用函数时没传参数，就用 deafultConfig（默认值）；如果传了，就用你的自定义参数覆盖默认值。
    const op = Object.assign({}, deafultConfig, config)

    
    outlinePass.value.edgeStrength = op.edgeStrength
    outlinePass.value.edgeGlow = op.edgeGlow    
    outlinePass.value.edgeThickness = op.edgeThickness
    outlinePass.value.visibleEdgeColor.set(op.visibleEdgeColor)
    outlinePass.value.hiddenEdgeColor.set(op.hiddenEdgeColor)
    // 这里的 selectedObjects 是关键：
    // 当你点击场景中的某个物体时，你需要执行 outlinePass.value.selectedObjects = [选中物体]。
    // 只有被放进这个数组的物体，才会产生发光轮廓。
    outlinePass.value.selectedObjects = []
    composer.addPass(outlinePass.value)
    
    // 负责色彩校正和最终输出
    const outputPass = new OutputPass()
    composer.addPass(outputPass)

    // 5. SMAAPass (最后一步！对包含 Outline 线条在内的全屏画面进行平滑)
    // 这样工字钢的硬边缘和 Outline 的发光边都会被反走样
    const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
    composer.addPass(smaaPass);    

    // 将配置好的 composer 存入 Map 供渲染循环使用
    composers.set('outline', composer)

    // 1.性能警告：
    //   OutlinePass 是比较耗 GPU 的。如果你同时让 900 个物体都发光，低配电脑可能会卡死。
    //   建议： 只在 selectedObjects 里放用户当前点击的那 1 个 或 1 组 物体。
    // 2.渲染器冲突：
    //   一旦执行了这个 addOutlineEffect，你之前在 onAnimate 里的逻辑就会生效：它会开始运行 composer.render()。
    //   请确保你已经按照我们之前的建议，关闭了原生的 renderer.render()，否则你会看到画面重叠或帧率减半。
    // 3.深度遮挡问题：
    //    如果你想让被墙体挡住的坛子也透出轮廓（像 X 光一样），你可以通过调整 hiddenEdgeColor 的透明度来实现。
    //    如果你想让选中的坛子有“呼吸感”，可以这样调用： 
    //   addOutlineEffect({
    //       edgeStrength: 5,
    //       pulsePeriod: 2, // 每 2 秒呼吸一次
    //       visibleEdgeColor: '#ffff00' // 金黄色轮廓
    //   })
  }

  // 添加outline效果
  // 
  // 非后期处理（Non-Post-Processing）的选中高亮效果。它没有使用复杂的 Shader 或 EffectComposer，
  // 而是通过直接修改模型材质的 自发光属性（Emissive） 来让物体“变亮”。
  // 
  // 相比于之前解释的 OutlinePass（外发光轮廓），这个 addHexEffect 有以下优缺点：
  // 特性,OutlinePass (后期处理),addHexEffect (材质自发光)
  // 视觉效果,物体边缘有发光线条，非常科幻。,整个物体表面变亮，像被灯照着。
  // 性能消耗,高（需要全屏扫描像素）。,极低（仅修改材质属性）。
  // 复杂度,需要配置 Composer 和 Pass。,纯逻辑代码，不需要额外插件。
  // 适用场景,强调选中边界。,简单的选中视觉反馈。  
  const addHexEffect = (color?: number | string) => {
    let selected: any[] = []
    hexPass.value = {
      // get selectedObjects(): 当你读取 hexPass.value.selectedObjects 时，它直接返回私有数组 selected。
      get selectedObjects() {
        return selected
      },
      // set selectedObjects(val): 这是精髓所在。当你执行 hexPass.value.selectedObjects = [新物体] 时，它会自动触发一系列“材质切换”动作：
      set selectedObjects(val) {
        // 先清空之前的
        // 在选中新物体之前，先遍历上一次选中的物体，把它们的自发光颜色（emissive）还原回最初保存的颜色（mesh.hex）。这样物体就会“熄灭”高亮。
        selected.forEach((mesh) => {          
          if (mesh.material) 
            mesh.material.emissive.setHex(mesh.hex)
        })

        // 高亮新物体
        val.forEach((mesh) => {
          // clone(): 因为在 Three.js 中，多个物体可能共用同一个材质。如果不克隆，你点亮一个物体，全厂 900 个物体都会一起发光。克隆确保了只有当前选中的物体材质发生变化。
          mesh.material = mesh.material.clone() // 关键：克隆材质
          mesh.hex = mesh.material.emissive.getHex() // 备份原始颜色
          mesh.material.emissive.setHex(color ?? 0x888888) // 设置高亮颜色
        })

        // 更新队列
        // 将当前选中的物体存入私有变量，等待下一次点击时被“熄灭”。
        selected = [...val]
      },
    }
  }

  // 模型拾取
  // 射线拾取（Raycasting）。简单来说，它的作用是检测你的鼠标点击了 3D 场景中的哪一个物体。
  // 它是通过模拟从相机发射出一道“激光束”，看这道光穿透了哪些模型来实现的。
  const addModelPick = (
    object: THREE.Object3D,
    callback: (
      intersects:
        | THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[]
        | []
    ) => void
  ) => {
    const handler = (event: MouseEvent) => {
      const el = container.value as HTMLElement
      if (!el) 
        return 

      const rect = el.getBoundingClientRect()
    
      // 1.坐标转换：从屏幕到 3D 空间
      // 原因：鼠标点击得到的坐标是屏幕像素（左上角为 $0,0$），而 Three.js 需要的是 NDC（归一化设备坐标），范围必须在 $-1$ 到 $+1$ 之间。
      // 计算逻辑：将相对于容器的像素位置，映射到以中心为原点的坐标系中。
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )

      // 2. 发射射线 (Raycaster)
      // Raycaster：创建一个“射线投射器”。
      // 代码中在 handler 内部 new THREE.Raycaster()， 性能陷阱？？？？
      const raycaster = new THREE.Raycaster()
      // setFromCamera：射线从相机的镜头出发，朝着鼠标点击的方向发射出去。
      raycaster.setFromCamera(mouse, camera.value!)
      // 3. 碰撞检测 (Intersection)
      // 作用：检查射线穿过了哪些物体。
      // 参数 true：开启递归检测。这意味着即使你传入的是整个厂房模型，它也能检测到厂房内部每一个细小的子零件（如具体的某个坛子）。
      // 返回值：intersects 是一个数组，按距离由近到远排序。intersects[0] 通常就是用户真正点到的那个物体。
      const intersects = raycaster.intersectObject(object, true)
      isFunction(callback) && callback(intersects)
      // if (intersects.length <= 0) return void 0
    }
    document.addEventListener('click', handler)
    // 4. 生命周期管理
    // 防止内存泄漏：当你离开这个 Vue 页面时，代码会自动移除点击监听器。如果不移除，监听器会一直堆积，导致程序越来越卡。
    onUnmounted(() => document.removeEventListener('click', handler))
  }

  // 模型悬浮拾取
  // 它的数学原理与“点击拾取”完全一致，但交互形式从“点击”变成了**“鼠标移动”**
  const addModelHoverPick = (
    object: THREE.Object3D,
    callback: (
      intersects:
        | THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[]
        | []
    ) => void
  ) => {
    const handler = (event: MouseEvent) => {
      const el = container.value as HTMLElement
      if (!el) 
        return 

      const rect = el.getBoundingClientRect()
      // 1.坐标标准化 (NDC Conversion):
      // 将鼠标在屏幕上的像素位置(x, y) 转换为 Three.js 的标准坐标( -1 ~~ +1 )。这一步是为了告诉 Raycaster 鼠标相对于画布中心的位置。
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      // 2.射线投射 (Raycasting):
      // 从相机视点发射一条穿过鼠标所在点的“隐形光束”。
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera.value!)
      // 3.相交检测 (Intersection):
      // 计算这束光碰到了哪些模型。如果数组 intersects 长度大于 0，说明鼠标正悬停在某个模型上方。
      const intersects = raycaster.intersectObject(object, true)
      // 4.回调执行:
      // 将检测结果（碰撞点、碰撞物体信息）传给 callback 进一步处理（比如改变物体颜色）。
      isFunction(callback) && callback(intersects)
      // if (intersects.length <= 0) return void 0
    }
    // 4. 核心差异：从 click 到 mousemove
    // 高频触发：与点击事件不同，mousemove 在鼠标移动时每秒会触发几十次。
    // 实时性：这要求你的回调函数（callback）执行效率必须极高，否则鼠标划过 900 个物体时，画面会感到明显的掉帧（Stuttering）。
    document.addEventListener('mousemove', handler)
    onUnmounted(() => document.removeEventListener('mousemove', handler))

    // 性能优化建议:
    // 由于 mousemove 触发频率极高，当前的写法存在两个严重的性能隐患：
    // A. 避免重复创建对象（防抖与复用）
    //    代码里每次移动鼠标都会 new THREE.Raycaster()。
    //    优化：将 raycaster 和 mouse 变量提到函数外面，只在初始化时创建一次，循环中只修改它们的值。
    // B. 增加“脏检查”逻辑
    //    在 callback 里，如果你每次悬停都去修改材质，性能开销会很大。
    //    优化思路：记录“上一次悬停的物体”。
    //    如果当前悬停物体 == 上一次悬停物体，不做任何事。
    //    如果不同，则取消上一个的高亮，开启当前的高亮。
    // C. 容器限制
    // document.addEventListener('mousemove', handler)
    // 目前监听的是整个 document。如果你的页面左侧有菜单栏，鼠标移到菜单上也会触发 3D 计算。
    // 建议：改为 container.value.addEventListener('mousemove', handler)，只监听 3D 画布区域。
  }

/**
// 你可以这样使用这个函数来实现“划过变色”：
let lastHoveredId = null;

addModelHoverPick(allJarsGroup, (intersects) => {
  const currentObject = intersects[0]?.object;
  
  if (currentObject?.uuid === lastHoveredId) return; // 还是同一个，跳过

  // 1. 清除旧的高亮
  resetAllJarsStyle(); 

  // 2. 开启新的高亮
  if (currentObject) {
    lastHoveredId = currentObject.uuid;
    currentObject.material.emissive.set(0x444444); // 微微发光
    document.body.style.cursor = 'pointer'; // 鼠标变手型
  } else {
    lastHoveredId = null;
    document.body.style.cursor = 'default';
  }
}); 
 */


  // Vue3 生命周期管理中的一个经典模式，它的作用是确保在 DOM 元素彻底渲染完成之后，再启动 Three.js 的初始化逻辑。
  // 由于 3D 场景需要挂载到一个真实的 HTML 容器（container）上，这段代码至关重要。
  // 
  // nextTick 是 等 Vue 把页面 DOM 全部更新完，再执行你要做的事情。
  // 在 Vue 中，当你修改了数据或者组件刚刚加载时，Vue 并不是立即更新 DOM 的，而是开启一个队列，异步地进行批量更新。
  // 在 Vue 的 setup 或 onMounted 钩子触发的瞬间，浏览器可能还没有完全计算好 <div ref="container"> 
  // 的宽度和高度。如果你立即启动 Three.js，渲染器可能拿到的宽高是 0，导致黑屏或画面拉伸。  
  nextTick(() => {
    boostrap()
  })

  return {
    container,
    scene,
    camera,
    renderer,
    cssRenderer,
    ocontrol,
    tcontrol,
    mixers,
    renderMixins,
    composers,
    outlinePass,
    hexPass,
    loadBgEnv,
    loadGltf,
    loadAnimationMixer,
    loadAxesHelper,
    loadCSS2DByVue,
    loadTestScene,
    transitionAnimation,
    planeClippingAnimation,
    addModelPick,
    addModelHoverPick,
    addOutlineEffect,
    addHexEffect,
  }
}

export default useThree
