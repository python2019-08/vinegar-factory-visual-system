const loadGltf = (url: string): Promise<GLTF> => {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  return new Promise<GLTF>((resolve, reject) => {
    loader.load(
      url,
      (object: GLTF) => {
        object.scene.traverse((child) => {
          // 使用 child.isMesh 确保它是网格物体
          if ((child as THREE.Mesh).isMesh && child.name.includes('mat_semitransparent')) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;

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

        // 将模型加入场景
        if (scene.value) {
          scene.value.add(object.scene);
        }
        
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
};