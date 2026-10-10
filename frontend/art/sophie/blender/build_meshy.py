"""Optimize and body-rig the user-supplied Meshy Sophie; originals stay untouched.
Blender 5.2: blender --background --factory-startup --python build_meshy.py -- /path/source.glb
This is a first body rig, not a facial rig or production skin-weight pass.
"""
import bpy, bmesh, math, sys, json
import numpy as np
from pathlib import Path
from mathutils import Vector, Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parent))
from walk_cycle import walk_pose, leg_weights
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'frontend/art/sophie/meshy-review';ART.mkdir(exist_ok=True)
OUT=ROOT/'frontend/public/assets/3d/characters/sophie-meshy.glb'
source=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else Path('/Users/psami/Downloads/Meshy_AI_SophieCharacterModel_1010133947_image-to-3d-texture.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');obj.name='Sophie_Meshy'
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
zmin=min(v.co.z for v in obj.data.vertices)
for v in obj.data.vertices:v.co.z-=zmin
# Weld coincident vertices across UV islands; UVs live on loops and stay intact.
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(obj.data);bm.free();obj.data.update()
# Simplify separate regions with their shared boundary vertices held in place.
# A weighted whole-mesh reduction can spend its budget on the face; explicit
# regional budgets make detail retention predictable and reviewable.
def region(face):
 co=face.calc_center_median();x,y,z=co
 if z>1.55:return 'head'
 if abs(x)>.28 and .82<z<1.02:return 'hands'
 return 'body'
parts=[]
for name,ratio in [('head',.24),('hands',.28),('body',.065)]:
 data=obj.data.copy();part=bpy.data.objects.new('Sophie_'+name,data);bpy.context.collection.objects.link(part)
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if region(f)!=name],context='FACES')
 bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(data);bm.free();data.update()
 boundary=set()
 bm=bmesh.new();bm.from_mesh(data);bm.verts.ensure_lookup_table()
 for edge in bm.edges:
  if edge.is_boundary:
   for v in edge.verts:boundary.add(v.index)
 bm.free()
 group=part.vertex_groups.new(name='ReductionInterior')
 for v in data.vertices:group.add([v.index],0 if v.index in boundary else 1,'REPLACE')
 bpy.ops.object.select_all(action='DESELECT');part.select_set(True);bpy.context.view_layer.objects.active=part
 dec=part.modifiers.new('Regional web reduction','DECIMATE');dec.ratio=ratio;dec.vertex_group=group.name;dec.vertex_group_factor=1;dec.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=dec.name);part.vertex_groups.remove(part.vertex_groups.get("ReductionInterior"));parts.append(part)
 print('REDUCED',name,len(part.data.vertices),sum(len(p.vertices)-2 for p in part.data.polygons),flush=True)
bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for part in parts:part.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='Sophie_Meshy'
bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(obj.data);bm.free();obj.data.update()
for p in obj.data.polygons:p.use_smooth=True
# Keep the generated colour map; tone down the generated plastic-like response.
mat=obj.data.materials[0];mat.name='Sophie_Meshy_Texture'
bs=mat.node_tree.nodes.get('Principled BSDF')
for name,value in [('Metallic',0),('Roughness',.82)]:
 for link in list(bs.inputs[name].links):mat.node_tree.links.remove(link)
 bs.inputs[name].default_value=value
for node in mat.node_tree.nodes:
 if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.3
 if node.type=='TEX_IMAGE' and node.image:
  im=node.image
  limit=2048 if any(link.to_socket.name=='Base Color' for link in node.outputs['Color'].links) else 1024
  if max(im.size)>limit:im.scale(limit,limit)
  im.file_format="PNG";im.pack()
# Texture-based bag identification avoids binding the bag to the left thigh/arm.
base=next(link.from_node.image for link in bs.inputs['Base Color'].links if link.from_node.type=='TEX_IMAGE')
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(base.size[1],base.size[0],4)
uv=obj.data.uv_layers.active.data
rgb=np.zeros((len(obj.data.vertices),3),dtype=np.float32);counts=np.zeros(len(rgb))
for loop in obj.data.loops:
 u,v=uv[loop.index].uv;rgb[loop.vertex_index]+=pixels[min(int(v*base.size[1]),base.size[1]-1)%base.size[1],min(int(u*base.size[0]),base.size[0]-1)%base.size[0],:3];counts[loop.vertex_index]+=1
rgb/=np.maximum(counts[:,None],1)
# An A-pose rig tailored to the generated silhouette, with no finger articulation yet.
arm=bpy.data.armatures.new('Sophie_Meshy_Rig');rig=bpy.data.objects.new('Sophie_Meshy_Rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;obj.select_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
specs=[('Root',(0,0,0),(0,0,.15),None),('Body',(0,0,1.04),(0,0,1.1),'Root'),('Hips',(0,0,1.04),(0,0,1.13),'Body'),('Abdomen',(0,0,1.13),(0,0,1.29),'Hips'),('Torso',(0,0,1.29),(0,0,1.41),'Abdomen'),('Chest',(0,0,1.41),(0,0,1.51),'Torso'),('Neck',(0,0,1.51),(0,0,1.59),'Chest'),('Head',(0,0,1.59),(0,0,1.81),'Neck')]
for sign,suffix in [(1,'L'),(-1,'R')]:
 def p(x,y,z):return (sign*x,y,z)
 specs.extend([('Shoulder.'+suffix,p(.02,0,1.49),p(.135,0,1.48),'Chest'),('UpperArm.'+suffix,p(.135,0,1.48),p(.245,0,1.19),'Shoulder.'+suffix),('LowerArm.'+suffix,p(.245,0,1.19),p(.315,-.012,.99),'UpperArm.'+suffix),('Wrist.'+suffix,p(.315,-.012,.99),p(.33,-.025,.845),'LowerArm.'+suffix),('UpperLeg.'+suffix,p(.105,0,1.045),p(.13,0,.56),'Hips'),('LowerLeg.'+suffix,p(.13,0,.56),p(.155,0,.10),'UpperLeg.'+suffix),('Foot.'+suffix,p(.155,0,.10),p(.155,-.12,.045),'LowerLeg.'+suffix)])
for name,h,t,parent in specs:
 b=arm.edit_bones.new(name);b.head=h;b.tail=t
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
segments={n:(Vector(h),Vector(t)) for n,h,t,_ in specs}
def distance(co,name):
 a,b=segments[name];v=b-a;t=max(0,min(1,(co-a).dot(v)/v.length_squared));return (co-(a+v*t)).length
# Region-aware continuous skinning prevents nearest-bone leakage between bag, arms and torso.
groups={n:obj.vertex_groups.new(name=n) for n,_,_,_ in specs}
for v in obj.data.vertices:
 x,y,z=v.co;ax=abs(x);suffix='L' if x>=0 else 'R';r,g,b=rgb[v.index]
 bag=x>.12 and .93<z<1.53 and r>b*.96 and max(r,g,b)<.38
 hair=z>1.48 and ax<.15 and r>g*1.07 and g>b*1.08 and max(r,g,b)<.65
 if z>1.585 or hair:weights={'Head':1}
 elif bag:weights={'Torso':1}
 elif .81<z<1.01 and ax>.26:weights={'Wrist.'+suffix:1}
 else:
  def nearweights(names):
   near=sorted([(distance(v.co,n),n) for n in names])[:2]
   weights={n:math.exp(-d*45) for d,n in near};total=sum(weights.values());return {n:w/total for n,w in weights.items()}
  if z<.81 or (z<.99 and ax<.23) or (z<1.2 and b>r*1.04 and g>r*1.02):
   weights=leg_weights(z,suffix)
  else:
   torso=nearweights(['Hips','Abdomen','Torso','Chest','Neck','Head'])
   armweights=nearweights(['Shoulder.'+suffix,'UpperArm.'+suffix,'LowerArm.'+suffix,'Wrist.'+suffix])
   edge=.11+max(0,1.45-z)*.12
   blend=max(0,min(1,(ax-edge)/.035)) if .81<z<1.53 else 0
   blend=blend*blend*(3-2*blend)
   weights={n:w*(1-blend) for n,w in torso.items()}
   for n,w in armweights.items():weights[n]=weights.get(n,0)+w*blend
 for name,w in weights.items():groups[name].add([v.index],w,'REPLACE')
obj.parent=rig;mod=obj.modifiers.new('Sophie body rig','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
# Four local clips use the same names/story-clock contract as the existing runtime.
scene=bpy.context.scene;scene.render.fps=30
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
def rotate(name,axis,angle):
 pb=rig.pose.bones[name];local=pb.bone.matrix_local.to_quaternion().inverted()@Vector(axis);pb.rotation_quaternion=Quaternion(local,angle)
for name,length in [('Idle_Neutral',60),('Idle',60),('Walk',40),('Wave',60)]:
 action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
 for f in range(length+1):
  phase=f/length*math.tau
  for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=Quaternion()
  rig.pose.bones['Body'].location=rig.pose.bones['Body'].bone.matrix_local.to_quaternion().inverted()@Vector((0,0,.003*math.sin(phase)))
  rotate('Chest',(1,0,0),.012*math.sin(phase))
  if name=='Walk':
   rig.pose.bones['Body'].location=rig.pose.bones['Body'].bone.matrix_local.to_quaternion().inverted()@Vector((0,0,walk_pose(phase)['body_z']))
   for sign,suffix in [(1,'L'),(-1,'R')]:
    a=phase+(0 if sign==1 else math.pi)
    leg=walk_pose(phase,0 if sign==1 else 1)
    rotate('UpperLeg.'+suffix,(1,0,0),leg['hip'])
    rotate('LowerLeg.'+suffix,(1,0,0),leg['knee'])
    rotate('Foot.'+suffix,(1,0,0),leg['ankle'])
    rotate('UpperArm.'+suffix,(1,0,0),.18*math.cos(a))
    rotate('LowerArm.'+suffix,(1,0,0),-.08-.08*max(0,math.sin(a)))
   rotate('Torso',(0,0,1),.035*math.sin(phase))
  elif name=='Wave':
   rotate('UpperArm.R',(0,1,0),math.radians(22))
   rotate('LowerArm.R',(0,1,0),math.radians(115)+.12*math.sin(phase*2))
   rotate('Wrist.R',(0,1,0),.22*math.sin(phase*2))
  elif name=='Idle':
   rotate('Head',(0,0,1),.025*math.sin(phase))
   rotate('LowerArm.R',(1,0,0),-.08-.04*math.sin(phase))
  for pb in rig.pose.bones:
   pb.keyframe_insert('location',frame=f,group=pb.name);pb.keyframe_insert('rotation_quaternion',frame=f,group=pb.name);pb.keyframe_insert('scale',frame=f,group=pb.name)
 rig.animation_data.action=None
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);track.mute=True
# Validate the evaluated Blender rig, not only the analytic solver. Bone-local
# translation axes differ from world Z, so compare actual ankle positions.
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Walk'
foot_error=0.;lowest_sole=1.;highest_sole=-1.
for frame in range(41):
 scene.frame_set(frame);bpy.context.view_layer.update()
 evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
 for side,suffix in [(0,'L'),(1,'R')]:
  expected=walk_pose(frame/40*math.tau,side);actual=rig.pose.bones['Foot.'+suffix].head
  foot_error=max(foot_error,abs(actual.y-expected['foot_y']),abs(actual.z-expected['foot_z']))
  if not expected['swing']:
   sole=min(posed.vertices[v.index].co.z for v in obj.data.vertices if v.co.z<.055 and (v.co.x>0)==(side==0))
   lowest_sole=min(lowest_sole,sole);highest_sole=max(highest_sole,sole)
 evaluated.to_mesh_clear()
assert foot_error<.001, 'Evaluated ankle missed target: '+str(foot_error)
assert lowest_sole>-.005 and highest_sole<.012, 'Stance foot must stay on ground: '+str((lowest_sole,highest_sole))
print('WALK_CHECK',foot_error,lowest_sole,highest_sole,flush=True)
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_force_sampling=True,export_materials='EXPORT',export_image_format='JPEG',export_image_quality=85,export_cameras=False,export_lights=False)
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Idle_Neutral'
scene.frame_set(0)
# Pack the resized images into the editable source; exclude the studio from exports.
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Sophie Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.45,.45,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.view_settings.view_transform='AgX'
def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((-3,-4,5),350,4),((3,-1,3),200,3),((0,3,4),300,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name='STUDIO light';o.data.energy=power;o.data.size=size;aim(o,(0,0,1))
bpy.ops.object.camera_add(location=(0,-4,1));cam=bpy.context.object;cam.name='REVIEW full body';cam.data.type='ORTHO';cam.data.ortho_scale=2.12;aim(cam,(0,0,.95));scene.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'frontend/art/sophie/blender/sophie-meshy-v2.blend'))
for label,clip,frame in [('neutral','Idle_Neutral',0),('walk','Walk',10),('wave','Wave',15)]:
 for track in rig.animation_data.nla_tracks:track.mute=track.name!=clip
 scene.frame_set(frame)
 if label=='wave':
  evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());posed=evaluated.to_mesh()
  leak=max((posed.vertices[v.index].co-v.co).length for v in obj.data.vertices if abs(v.co.x)<.235 and .2<v.co.z<1.15 and rgb[v.index][2]>rgb[v.index][0]*1.04 and rgb[v.index][1]>rgb[v.index][0]*1.02)
  evaluated.to_mesh_clear();assert leak<.04, 'Wave must not pull jeans: '+str(leak)
 scene.render.filepath=str(ART/('optimized-'+label+'.png'));bpy.ops.render.render(write_still=True)
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Idle_Neutral'
scene.frame_set(0);cam.data.ortho_scale=.55;cam.location=(0,-3,1.72);aim(cam,(0,0,1.72));scene.render.filepath=str(ART/'optimized-face.png');bpy.ops.render.render(write_still=True)
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Walk'
scene.frame_set(30);cam.data.ortho_scale=2.12;cam.location=(4,0,1);aim(cam,(0,0,.95));scene.render.filepath=str(ART/'walk-knee-profile.png');bpy.ops.render.render(write_still=True)
report={'walkMaxFootError':foot_error,'stanceSoleZRange':[lowest_sole,highest_sole],'source':str(source),'vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'glbBytes':OUT.stat().st_size,'bones':len(arm.bones),'clips':['Idle','Idle_Neutral','Walk','Wave'],'limitations':['First-pass procedural body motion and analytic skin weights; inspect sleeve, trouser and strap deformation.','No finger articulation or facial shape keys.','No physical-device performance validation.']}
(ART/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('MESHY_COMPLETE',report)
