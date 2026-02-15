import { PerspectiveCamera, Environment } from '@react-three/drei'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas} from '@react-three/fiber'
import { XR, createXRStore } from '@react-three/xr'
import * as THREE from 'three'
import {InfoPanel} from './components/Panels'
import { LaserPointer, ControllerShortcuts, Spawner } from './components/Controller'
import { GalleryObjects, positionsOnCircle, lookAtCenterRotationY } from './components/Model'
import type {ObjDef} from './components/Model'

const store = createXRStore({
  emulate: false,
  hand: { rayPointer: { rayModel: { color: 'red' } } },
})

const base = import.meta.env.BASE_URL //корректива при деплое на gh pages

// библиотека моделей, которые можно спавнить, гружу все сразу так как типы предопределены

const MODEL_LIBRARY: Array<Omit<ObjDef, 'id' | 'position'>> = [
  { kind: 'board',   url: `${base}/assets/cigarette/scene.gltf`,        scale: 1 },
  { kind: 'cabinet', url: `${base}/assets/lowpoly_cabinets/scene.gltf`, scale: 1 },
  { kind: 'malboro', url: `${base}/assets/lowpoly_road_barrier/scene.gltf`, scale: 6 },
  { kind: 'shark',   url: `${base}/assets/lowpoly_shark/scene.gltf`,    scale: 0.7 },
  { kind: 'grave',   url: `${base}/assets/speaker/scene.gltf`,          scale: 0.5 },
]

export default function App() {

  const interactablesRef = useRef(new Map<string, THREE.Object3D | null>()) //коллекция объектов (и их id) для взаимодействия с лучом

  const setInteractable = (id: string, obj: THREE.Object3D | null) => {
    interactablesRef.current.set(id, obj)
  }

  //useMemo чтобы сработало один раз, а не при каждом рендере 
  const initialObjects = useMemo<ObjDef[]>(() => {
    const defs = MODEL_LIBRARY.map((m) => ({
      id: m.kind,
      kind: m.kind,
      url: m.url,
      scale: m.scale,
    }))

    const positions = positionsOnCircle(defs.length, 3, 1.4, Math.PI / 2)

    return defs.map((d, i) => {
      const position = positions[i]
      let rotationY = lookAtCenterRotationY(position)

      //небольшие коррективы под модельки
      if (d.id === 'malboro') rotationY += Math.PI / 2
      if (d.id === 'shark') rotationY += Math.PI / 6

      return { ...d, position, rotationY } //добавляю к коллекции стартовых объектов позицию и поворот на игрока
    })
  }, [])


  //состояния
  const [polyById, setPolyById] = useState<Record<string, number>>({})
  const [inVR, setInVR] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [objects, setObjects] = useState<ObjDef[]>(() => initialObjects)
  const [spawnTick, setSpawnTick] = useState(0)
  const idCounterRef = useRef(1000)

  //удаление объекта по кнопке (так же удаляются состояния)
  function deleteObject(id: string) {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    interactablesRef.current.delete(id)
    setHoveredId((cur) => (cur === id ? null : cur))
  }


  //подписка на вход и выход из VR
  useEffect(() => {
    const unsub = store.subscribe((s) => {
      setInVR(!!s.session)
    })
    setInVR(!!store.getState().session)
    return () => unsub()
  }, [])


  return (
    <>

      <InfoPanel
        inVR={inVR}
        hoveredId={hoveredId}
        objects={objects}
        polyById={polyById}
        onToggleVR={() => {
          const session = store.getState().session
          if (session) session.end()
          else store.enterVR()
        }}
        onAddObject={() => setSpawnTick((t) => t + 1)}
      />


      <Canvas style={{ height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, zIndex: 0 }}>

        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 6, 2]} intensity={1.6} />

        <PerspectiveCamera makeDefault position={[0, 1.6, 2]} />

        <Environment 
          background={true}
          backgroundBlurriness={0.7}   //поэкспериментировал с окружением, чтобы выглядело поприятнее 
          preset='sunset'
        />

        <XR store={store}>

        
        <ControllerShortcuts
          hoveredId={hoveredId}
          onDelete={(id) => deleteObject(id)} //объект для подхвата кнопок контроллера
        />

        <Spawner
          spawnTick={spawnTick}
          onSpawn={(pos) => {
            const base = MODEL_LIBRARY[Math.floor(Math.random() * MODEL_LIBRARY.length)]  //спавнер моделек по кнопке html
            const newId = `${base.kind}-${idCounterRef.current++}` //всем объектам нужен уникальный id, собираем его из типа + число

            setObjects((prev) => [
              ...prev,
              {
                id: newId,
                kind: base.kind,
                url: base.url,
                scale: base.scale,
                position: pos,
                rotationY: 0,
              },
            ])
          }}
        />

          {/* <VRHud
            inVR={inVR}
            hoveredId={hoveredId}
            hoveredKind={hoveredId ? objects.find(o => o.id === hoveredId)?.kind ?? null : null}
            triangles={hoveredId ? polyById[hoveredId] ?? null : null}
            onToggleVR={() => {
              const session = store.getState().session
              if (session) session.end()
              else store.enterVR()
            }}
          /> */}

          <LaserPointer interactablesRef={interactablesRef} onHover={setHoveredId} />

          <GalleryObjects
            objects={objects}
            hoveredId={hoveredId}
            onPoly={(id, tris) => setPolyById((p) => ({ ...p, [id]: tris }))}
            setInteractable={setInteractable}
          />
        </XR>
      </Canvas>
    </>
  )
}


