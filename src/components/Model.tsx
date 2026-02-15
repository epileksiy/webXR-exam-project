import { useGLTF, useTexture } from '@react-three/drei'
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

const base = import.meta.env.BASE_URL //корректива при деплое на gh pages

export type ObjKind = 'board' | 'cabinet' | 'malboro' | 'shark' | 'grave'

export type ObjDef = {
  id: string
  kind: ObjKind
  url: string
  position: [number, number, number]
  scale?: number
  rotationY?: number
}

// функция для начального спавна объектов, посчитал разумным добавить равномерное распределение по дуге, иначе объекты иногда спавнились друг в друге
export function positionsOnCircle(
  count: number,
  radius = 3,
  y = 1.4,
  startAngle = 0
): [number, number, number][] {
  if (count <= 0) return []

  const step = (Math.PI * 2) / count
  const out: [number, number, number][] = []

  for (let i = 0; i < count; i++) {
    const a = startAngle + i * step
    const x = Math.cos(a) * radius
    const z = Math.sin(a) * radius
    out.push([x, y, z])
  }

  return out
}


// function randomAround(radius = 3): [number, number, number] {
//   const angle = Math.random() * Math.PI * 2
//   const r = radius + (Math.random() - 0.5) * 0.3
//   const x = Math.cos(angle) * r
//   const z = Math.sin(angle) * r
//   const y = 1 + Math.random() * 0.5
//   return [x, y, z]
// }


// функция для поворота объектов на игрока, визуально приятнее 
export function lookAtCenterRotationY(pos: [number, number, number]) {
  const [x, , z] = pos
  return Math.atan2(x, z) + Math.PI // yaw
}

//подсчёт полигонов
function countTriangles(root: THREE.Object3D): number {
  let tris = 0

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!(mesh as any).isMesh) return
    const geom = mesh.geometry as THREE.BufferGeometry | undefined
    if (!geom) return

    const index = geom.index
    if (index) tris += index.count / 3
    else tris += (geom.getAttribute('position')?.count ?? 0) / 3
  })

  return Math.floor(tris)
}


//функция репрезентации объекта: логика подсветки при наведении, подсёт полигонов
export function ModelObject({
  def,
  hovered,
  setInteractable,
  onPoly
}: {
  def: ObjDef
  hovered: boolean
  setInteractable: (id: string, obj: THREE.Object3D | null) => void
  onPoly: (id: string, tris: number) => void
}) {
  const { scene } = useGLTF(def.url)

  const root = useMemo(() => scene.clone(true), [scene])

  useMemo(() => {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if ((mesh as any).isMesh) {

        mesh.userData.id = def.id
        mesh.userData.kind = def.kind

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone())
        } else if (mesh.material) {
          mesh.material = mesh.material.clone()
        }
      }
    })
  }, [root, def.id, def.kind])

  useEffect(() => {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!(mesh as any).isMesh) return
      const mat: any = mesh.material
      if (!mat) return
      if ('emissive' in mat) {
        mat.emissive = new THREE.Color('white')
        mat.emissiveIntensity = hovered ? 0.25 : 0
        mat.needsUpdate = true
      }
    })
  }, [root, hovered])

  useEffect(() => {
    const tris = countTriangles(root)
    onPoly(def.id, tris)
  }, [root, def.id, onPoly])


  return (
    <group
      ref={(g) => setInteractable(def.id, g as unknown as THREE.Object3D | null)}
      position={def.position}
      rotation={[0, def.rotationY ?? 0, 0]}
      scale={def.scale ?? 1}
    >
      <primitive object={root} />
    </group>
  )
}


//функция сцены: выгрузка объектов сцены + пол
export function GalleryObjects({
  objects,
  hoveredId,
  onPoly,
  setInteractable
}: {
  objects: ObjDef[]
  hoveredId: string | null
  onPoly: (id: string, tris: number) => void
  setInteractable: (id: string, obj: THREE.Object3D | null) => void
}) {

  const grassMap = useTexture(`${base}/assets/grassTex.jpg`)  //решил добавить для красоты пол с текстурой как в Garrys Mod
  grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping
  grassMap.repeat.set(30, 30)

  const grassMapNormal = useTexture(`${base}/assets/grassTexNormal.png`)
  grassMapNormal.wrapS = grassMapNormal.wrapT = THREE.RepeatWrapping
  grassMapNormal.repeat.set(30, 30)

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#ffffff" map={grassMap} normalMap={grassMapNormal} />
      </mesh>

      {objects.map((def) => (
        <ModelObject
          key={def.id}
          def={def}
          hovered={hoveredId === def.id}
          setInteractable={setInteractable}
          onPoly={onPoly}
        />
      ))}
    </>
  )
}