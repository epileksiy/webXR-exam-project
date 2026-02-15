import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { ObjDef } from './Model'



//информационная панель HTML VR-сессии
export  function InfoPanel({
  inVR,
  hoveredId,
  objects,
  polyById,
  onToggleVR,
  onAddObject,
}: {
  inVR: boolean
  hoveredId: string | null
  objects: ObjDef[]
  polyById: Record<string, number>
  onToggleVR: () => void
  onAddObject: () => void
}) {
  const hovered = hoveredId ? objects.find((o) => o.id === hoveredId) : null
  const tris = hoveredId ? polyById[hoveredId] ?? null : null

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 1000,
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.65)',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        borderRadius: 10,
        minWidth: 220,
        pointerEvents: 'auto'
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Инфо</div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ opacity: 0.75 }}>Hovered object:</div>
        <div>{hovered ? `${hovered.kind} (${hovered.id})` : '—'}</div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ opacity: 0.75 }}>Polygons (triangles):</div>
        <div>{typeof tris === 'number' ? tris.toLocaleString() : '—'}</div>
      </div>

      <button
        onClick={onToggleVR}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {inVR ? 'Выйти из VR' : 'VR Mode'}
      </button>

      <button
        // disabled={!inVR}
        onClick={() => {
          if (!inVR) return
          onAddObject()
          console.log('Adding new object')
        }}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 10,
          border: 'none',
          cursor: inVR ? 'pointer' : 'not-allowed',
          marginTop: 10,
          opacity: inVR ? 1 : 0.4, 
        }}
      >
        Добавить объект
      </button>
    </div>
  )
}



//информационная панель in XR VR-сессии (переделывал пункт про панель, не заметил, что надо было HTML :))
export function VRHud({
  inVR,
  hoveredId,
  hoveredKind,
  triangles,
  onToggleVR,
}: {
  inVR: boolean
  hoveredId: string | null
  hoveredKind: string | null
  triangles: number | null
  onToggleVR: () => void
}) {
  const group = useRef<THREE.Group | null>(null)
  const { camera } = useThree()
  const [btnHover, setBtnHover] = useState(false)

  // позиционируем панель "в углу" относительно камеры
  useFrame(() => {
    if (!group.current) return

    const dist = 1.2         // расстояние панели от головы (метры)
    const offsetRight = 0.55 // вправо (в метрах в мире)
    const offsetUp = 0.32    // вверх

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

    group.current.position
      .copy(camera.position)
      .add(forward.multiplyScalar(dist))
      .add(right.multiplyScalar(offsetRight))
      .add(up.multiplyScalar(offsetUp))

    // чтобы панель всегда смотрела на тебя
    group.current.quaternion.copy(camera.quaternion)

    // // рисуем поверх сцены (на всякий)
    // group.current.renderOrder = 999
  })

  const label1 = hoveredId ? `Hovered: ${hoveredKind ?? hoveredId}` : 'Hovered: —'
  const label2 = triangles != null ? `Polygons: ${triangles.toLocaleString()}` : 'Polygons: —'

  return (
    <group ref={group} scale={0.25}>
      {/* фон панели */}
      <mesh renderOrder={999}>
        <planeGeometry args={[1.9, 0.9]} />
        <meshBasicMaterial transparent opacity={0.85} depthTest={false} depthWrite={false} color={'black'}/>
      </mesh>

      {/* заголовок */}
      <Text
        position={[-0.88, 0.33, 0.01]}
        fontSize={0.14}
        anchorX="left"
        anchorY="middle"
        color="white"
        renderOrder={1000}
      >
        Info
      </Text>

      {/* строки */}
      <Text
        position={[-0.88, 0.10, 0.01]}
        fontSize={0.11}
        anchorX="left"
        anchorY="middle"
        color="white"
        renderOrder={1000}
      >
        {label1}
      </Text>

      <Text
        position={[-0.88, -0.10, 0.01]}
        fontSize={0.11}
        anchorX="left"
        anchorY="middle"
        color="white"
        renderOrder={1000}
      >
        {label2}
      </Text>

      {/* 3D кнопка */}
      <group position={[0.55, -0.28, 0.02]}>
        <mesh
          onPointerOver={() => setBtnHover(true)}
          onPointerOut={() => setBtnHover(false)}
          onClick={onToggleVR}
          renderOrder={1000}
        >
          <planeGeometry args={[0.7, 0.22]} />
          <meshBasicMaterial
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
            color={btnHover ? '#ffffff' : '#dddddd'}
          />
        </mesh>

        <Text
          position={[0, 0, 0.01]}
          fontSize={0.1}
          anchorX="center"
          anchorY="middle"
          color="black"
          renderOrder={1001}
        >
          {inVR ? 'Exit VR' : 'VR Mode'}
        </Text>
      </group>
    </group>
  )
}