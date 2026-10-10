"""Rebuild the editable Sophie silhouette study. Run with Blender --background --python.
Original CC0 proxy is never overwritten. Coordinates here are Blender Z-up, facing -Y.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'frontend/art/sophie'
sys.path.insert(0,str(Path(__file__).resolve().parent))
from face_authoring import build_face
OUT=ROOT/'frontend/public/assets/3d/characters/sophie-study.glb'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT.with_name('sophie.glb')))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.data.pose_position='REST'
for o in list(bpy.data.objects):
 if o.type=='MESH' and not o.modifiers:
  bpy.data.objects.remove(o,do_unlink=True)
def colour(hex):
 rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
def material(name,hex):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
 m.diffuse_color=colour(hex); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.85
 return m
palette={'Skin':'efc1a5','White':'f1e5d1','Grey':'e7e2da','Orange':'91aecb','Hair_Blond':'947455','Hair_Brown':'574132','Brown':'46362b'}
for name,hex in palette.items(): material(name,hex)
hair=material('Sophie_Hair','806049'); hairlight=material('Sophie_HairHighlight','a08161')
knit=material('Sophie_Knit','eee1c9'); rib=material('Sophie_Rib','d9cbb5')
leather=material('Sophie_Leather','49372f'); seam=material('Sophie_Seam','6c5140'); gold=material('Sophie_Gold','b88a43')
def bind(obj,weights):
 obj.parent=rig
 mod=obj.modifiers.new('Sophie humanoid rig','ARMATURE'); mod.object=rig
 groups={}
 for v in obj.data.vertices:
  for bone,w in weights(v.co).items():
   if w>0:
    if bone not in groups: groups[bone]=obj.vertex_groups.new(name=bone)
    groups[bone].add([v.index],w,'REPLACE')
 for p in obj.data.polygons: p.use_smooth=True
 return obj
def mesh(name,verts,faces,mat,weights):
 data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.materials.append(mat); data.update()
 o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o)
 return bind(o,weights)
def fixed(bone): return lambda co:{bone:1}
def sphere(name,center,scale,mat,bone,segments=24,rings=12):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
 o=bpy.context.object; o.name=name; o.scale=scale
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.data.materials.append(mat); return bind(o,fixed(bone))
def tube(name,points,radii,mat,weights,sides=10):
 # A transported circular section gives clean, editable tapered hair/clothing geometry.
 verts=[]; faces=[]
 for i,p in enumerate(points):
  p=Vector(p); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
  tangent.normalize(); axis=tangent.cross(Vector((0,1,0)))
  if axis.length<.01: axis=tangent.cross(Vector((1,0,0)))
  axis.normalize(); other=tangent.cross(axis).normalized()
  radius=radii[i] if isinstance(radii,list) else radii
  for j in range(sides): verts.append(p+radius*(math.cos(j*math.tau/sides)*axis+math.sin(j*math.tau/sides)*other))
 for i in range(len(points)-1):
  for j in range(sides):
   a=i*sides+j; b=i*sides+(j+1)%sides; faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))])
 return mesh(name,verts,faces,mat,weights)
# Replace the inherited block face with an editable head and authored expressions.
old_head=bpy.data.objects['Casual_Head']
bpy.data.objects.remove(old_head,do_unlink=True)
head=build_face(mesh,sphere,tube,material,fixed)
# Relax the fitted T-shirt into a soft sweater torso.
body=bpy.data.objects['Casual_Body']
shirtverts={i for p in body.data.polygons if body.data.materials[p.material_index].name=='White' for i in p.vertices}
for i in shirtverts:
 v=body.data.vertices[i]; v.co.x*=1.07; v.co.y=-.065+(v.co.y+.065)*1.1
# Widen lower legs around each leg's centre, leaving hip and knee topology/weights intact.
for v in bpy.data.objects['Casual_Legs'].data.vertices:
 x,y,z=v.co; side=1 if x>=0 else -1; centre=side*.097
 flare=max(0,min(1,(.85-z)/.65))
 v.co.x=centre+(x-centre)*(1+flare*.85)
 v.co.y=-.065+(y+.065)*(1+flare*.38)
 if z<.22: v.co.z-=.055*(.22-z)/.08
# Long sleeves follow the existing shoulder/elbow/wrist joints.
for side,suffix in [(1,'L'),(-1,'R')]:
 def armweights(co,suffix=suffix):
  t=max(0,min(1,(abs(co.x)-.27)/.13))
  return {'UpperArm.'+suffix:1-t,'LowerArm.'+suffix:t}
 points=[(side*x,-.067,1.443) for x in [.10,.19,.26,.32,.38,.44,.50,.545]]
 tube('Sophie_Sleeve.'+suffix,points,[.073,.074,.069,.062,.061,.063,.055,.043],knit,armweights,16)
 tube('Sophie_Cuff.'+suffix,[(side*x,-.067,1.443) for x in [.52,.535,.555,.57]],[.046,.046,.043,.041],rib,armweights,16)
 # Quiet raised cuff rings read as knit at conversation distance.
 for j in range(4):
  x=.528+j*.009
  tube('Sophie_CuffRib.%s.%s'%(suffix,j),[(side*x,-.067,1.443),(side*(x+.002),-.067,1.443)],.047,knit,armweights,12)
# Sculpted scalp shell with a higher forehead opening and lower nape.
verts=[]; faces=[]; rings=10; sides=40
for i in range(rings+1):
 t=(i+.04)/(rings+.04)
 for j in range(sides):
  a=j*math.tau/sides; front=max(0,-math.sin(a)); back=max(0,math.sin(a))
  rim=1.675+.065*front-.07*back
  phi=t*math.pi/2
  verts.append((.117*math.sin(phi)*math.cos(a),-.035+.143*math.sin(phi)*math.sin(a),1.843-(1.843-rim)*(1-math.cos(phi))))
for i in range(rings):
 for j in range(sides):
  a=i*sides+j; b=i*sides+(j+1)%sides; faces.append((a,b,b+sides,a+sides))
mesh('Sophie_Scalp',verts,faces,hair,fixed('Head'))
sphere('Sophie_Bun',(0,.052,1.858),(.081,.068,.079),hair,'Head',32,16)
# Curved bun locks: actual geometry, no painted portrait decal.
for j in range(9):
 a=j*math.tau/9; pts=[]
 for i in range(9):
  t=i/8; angle=a+t*1.25
  pts.append((.079*math.cos(angle)*math.sin(.15+t*2.7),.052+.068*math.sin(angle)*math.sin(.15+t*2.7),1.858+.079*math.cos(.15+t*2.7)))
 tube('Sophie_BunLock.%02d'%j,pts,[.003,.005,.005,.005,.005,.005,.004,.003,.001],hairlight if j%3==0 else hair,fixed('Head'),8)
# Two separated swept locks avoid the old overlapping strand surfaces.
for j in range(2):
 d=j*.024
 tube('Sophie_Fringe.%02d'%j,[(.065-d,-.105,1.82),(.045-d,-.155,1.798),(.005-d,-.183-j*.003,1.765),(-.04-d,-.183-j*.003,1.724),(-.074-d*.3,-.151,1.685)],[.018,.022,.018,.010,.001],hair,fixed('Head'),16)
for sign in [-1,1]:
 tube('Sophie_CheekStrand.%s'%sign,[(sign*.095,-.09,1.765),(sign*.112,-.135,1.7),(sign*.108,-.145,1.64),(sign*.125,-.115,1.59),(sign*.108,-.10,1.563)],[.016,.014,.010,.007,.001],hair,fixed('Head'),10)
# Bag at anatomical left hip; rigged to torso so it follows the body through walking.
sphere('Sophie_ShoulderBag',(.245,-.005,1.085),(.068,.065,.125),leather,'Torso')
sphere('Sophie_BagFlap',(.245,-.06,1.13),(.060,.012,.061),seam,'Torso')
def ribbon(name,points,width,mat,bone):
 vs=[]
 for p in points: vs.extend([(p[0]-width/2,p[1],p[2]),(p[0]+width/2,p[1],p[2])])
 return mesh(name,vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],mat,fixed(bone))
ribbon('Sophie_BagStrap',[(.24,-.08,1.13),(.23,-.13,1.27),(.17,-.145,1.42),(.13,-.09,1.49),(.13,.015,1.49),(.18,.065,1.38),(.25,.073,1.20)],.023,leather,'Torso')
sphere('Sophie_BagBuckle',(.225,-.137,1.285),(.016,.005,.02),gold,'Torso',16,8)
# Fine necklace with a small pendant on the sweater front.
tube('Sophie_Necklace',[(-.06,-.106,1.508),(-.05,-.17,1.43),(0,-.205,1.37),(.05,-.17,1.43),(.06,-.106,1.508)],.0015,gold,fixed('Chest'),8)
sphere('Sophie_Pendant',(0,-.207,1.365),(.009,.003,.012),gold,'Chest',16,8)
# Smooth the inherited low-poly surfaces without changing facial landmarks.
for obj in bpy.context.scene.objects:
 if obj.type=='MESH':
  for polygon in obj.data.polygons: polygon.use_smooth=True
# Export only the rigged character. Reference empties and studio stay in the .blend.
rig.data.pose_position='POSE'
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks: track.mute=True
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in {'MESH','ARMATURE'}: o.select_set(True)
bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks: track.mute=False
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
# Choose neutral pose for the saved studio and viewport, preserving all NLA clips.
for track in rig.animation_data.nla_tracks: track.mute=track.name!='Idle_Neutral'
bpy.context.scene.frame_set(0)
reference=bpy.data.objects.new('REFERENCE — Sophie turnaround (not exported)',None)
bpy.context.collection.objects.link(reference); reference.empty_display_type='IMAGE'; reference.data=bpy.data.images.load(str(ART/'sophie-turnaround-v1.png')); reference.data.pack(); reference.empty_display_size=3.1; reference.location=(2,.7,1); reference.rotation_euler=(math.pi/2,0,0); reference.hide_render=True
original=bpy.data.objects.new('REFERENCE — original Sophie portrait (authoritative)',None)
bpy.context.collection.objects.link(original); original.empty_display_type='IMAGE'; original.data=bpy.data.images.load(str(ROOT/'frontend/public/assets/characters/sophie/conversation/encouraging/closed.png')); original.data.pack(); original.empty_display_size=1.8; original.location=(-1.5,.7,1); original.rotation_euler=(math.pi/2,0,0); original.hide_render=True
# Soft studio, with front/profile/back cameras ready for review.
mat=material('Studio_Ground','e9e1d5')
bpy.ops.mesh.primitive_plane_add(size=200); ground=bpy.context.object; ground.name='STUDIO — ground (not exported)'; ground.data.materials.append(mat); ground.location.z=-.016
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.world.color=(.4,.4,.4)
def aim(o,at): o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,energy,size in [('Key',(-3,-4,6),450,4),('Fill',(3,-1,3),250,3),('Rim',(0,3,4),400,3)]:
 data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
 o=bpy.data.objects.new('STUDIO — '+name,data); scene.collection.objects.link(o); o.location=loc; aim(o,(0,0,1))
for name,loc in [('Front',(0,-5,1.12)),('Profile',(5,0,1.12)),('Back',(0,5,1.12)),('Portrait',(.55,-3,1.65))]:
 data=bpy.data.cameras.new(name); data.type='ORTHO'; data.ortho_scale=2.2 if name!='Portrait' else .6
 o=bpy.data.objects.new('REVIEW — '+name,data); scene.collection.objects.link(o); o.location=loc; aim(o,(0,0,1) if name!='Portrait' else (0,-.02,1.72))
scene.camera=bpy.data.objects['REVIEW — Front']; scene.render.resolution_x=640; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
bpy.ops.object.select_all(action='DESELECT'); head.select_set(True); bpy.context.view_layer.objects.active=head
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_distance=2.8; area.spaces.active.region_3d.view_location=(0,0,1); area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'blender/sophie-study-v2.blend'))
for name in ['Front','Profile','Back','Portrait']:
 scene.camera=bpy.data.objects['REVIEW — '+name]
 scene.render.filepath=str(ART/('sophie-study-v2-'+name.lower()+'.png'))
 bpy.ops.render.render(write_still=True)
# Expression review images share the portrait camera and neutral skeletal pose.
scene.camera=bpy.data.objects['REVIEW — Portrait']
for expression in ['blink','talk']:
 for o in bpy.data.objects:
  if o.type=='MESH' and o.data.shape_keys:
   for key in o.data.shape_keys.key_blocks:
    if key.name!='Basis': key.value=1 if (expression=='blink' and key.name.startswith('blink_')) or (expression=='talk' and key.name=='jawOpen') else 0
 scene.render.filepath=str(ART/('sophie-study-v2-'+expression+'.png'))
 bpy.ops.render.render(write_still=True)
print('SOPHIE_STUDY_COMPLETE',str(OUT))
