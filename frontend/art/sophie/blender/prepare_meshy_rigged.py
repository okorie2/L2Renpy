"""Prepare the supplied Meshy walk for opt-in review; preserve its skeleton/weights.
Usage: Blender --background --python prepare_meshy_rigged.py -- /path/export.zip
The source ZIP and existing default character are never changed.
"""
import bpy, math, json, zipfile, sys, tempfile
from pathlib import Path
from mathutils import Vector, Quaternion
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'frontend/art/sophie/meshy-rigged-review'; ART.mkdir(exist_ok=True)
OUT=ROOT/'frontend/public/assets/3d/characters/sophie-meshy-rigged.glb'
source=Path(sys.argv[sys.argv.index('--')+1])
with zipfile.ZipFile(source) as z:
 member=next(n for n in z.namelist() if n.endswith('_Walking_withSkin.glb'))
 with tempfile.NamedTemporaryFile(suffix='.glb') as tmp:
  tmp.write(z.read(member));tmp.flush()
  bpy.ops.wm.read_factory_settings(use_empty=True)
  bpy.ops.import_scene.gltf(filepath=tmp.name)
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
obj=next(o for o in scene.objects if o.type=='MESH' and o.parent==rig)
for o in list(scene.objects):
 if o not in (rig,obj):bpy.data.objects.remove(o,do_unlink=True)
rig.name='Sophie_Meshy_AutoRig';obj.name='Sophie_Meshy_Rigged'
walk=rig.animation_data.action;walk.name='Walk'
# In-place story locomotion: keep Meshy's pelvis sway/bob, remove forward drift.
# Keep the original joint matrices and animation slot; never reconstruct bones.
curves=[fc for layer in walk.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
root_start={}
for fc in curves:
 if fc.data_path=='pose.bones["mixamorig:Hips"].location' and fc.array_index in (0,1):
  points=fc.keyframe_points
  if len(points)>1:
   first,last=points[0].co[:],points[-1].co[:];slope=(last[1]-first[1])/(last[0]-first[0])
   root_start[str(fc.array_index)]=last[1]-first[1]
   for key in points:
    correction=slope*(key.co.x-first[0]);key.co.y-=correction;key.handle_left.y-=correction;key.handle_right.y-=correction
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
# The export has no idle. A neutral bind pose with gentle breathing is a local
# review fallback, not an idle animation supplied by Meshy.
idle=bpy.data.actions.new('Idle_Neutral');rig.animation_data.action=idle
for f in (0,15,30,45,60):
 for pb in rig.pose.bones:
  pb.rotation_mode='QUATERNION';pb.location=(0,0,0);pb.rotation_quaternion=Quaternion();pb.scale=(1,1,1)
 chest=rig.pose.bones['mixamorig:Spine2'];chest.rotation_quaternion=Quaternion((1,0,0),.008*math.sin(f/60*math.tau))
 for pb in rig.pose.bones:
  pb.keyframe_insert('location',frame=f);pb.keyframe_insert('rotation_quaternion',frame=f);pb.keyframe_insert('scale',frame=f)
rig.animation_data.action=None
for action in (walk,idle):
 track=rig.animation_data.nla_tracks.new();track.name=action.name;track.strips.new(action.name,0,action);track.mute=True
# Keep the imported skinning while reducing the mesh to a browser budget.
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
armature=next(m for m in obj.modifiers if m.type=='ARMATURE')
armature.show_viewport=False
mod=obj.modifiers.new('Web mesh reduction','DECIMATE');mod.ratio=.49;mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name);armature.show_viewport=True
for p in obj.data.polygons:p.use_smooth=True
for mat in obj.data.materials:
 bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for name,value in [('Metallic',0),('Roughness',.82)]:
  for link in list(bs.inputs[name].links):mat.node_tree.links.remove(link)
  bs.inputs[name].default_value=value
for im in bpy.data.images:
 if im.source=='FILE':im.pack()
scene.render.engine='CYCLES';scene.cycles.samples=16
scene.render.resolution_x=600;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Review studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.45,.45,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.view_settings.view_transform='AgX'
def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((-3,-4,5),350,4),((3,-1,3),200,3),((0,3,4),300,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;aim(o,(0,0,.85))
bpy.ops.object.camera_add(location=(0,-4,.85));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.95;aim(cam,(0,0,.85));scene.camera=cam
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Idle_Neutral'
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'frontend/art/sophie/blender/sophie-meshy-autorig.blend'))
source_sizes=[list(im.size) for im in bpy.data.images if im.type=='IMAGE']
for im in bpy.data.images:
 if im.type=='IMAGE' and max(im.size)>2048:im.scale(2048,2048);im.pack()
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_image_format='JPEG',export_jpeg_quality=90,export_materials='EXPORT',export_force_sampling=True)
for name,frame,side in [('neutral',0,False),('walk',6,False),('walk-profile',6,True)]:
 for track in rig.animation_data.nla_tracks:track.mute=track.name!=('Idle_Neutral' if name=='neutral' else 'Walk')
 scene.frame_set(frame)
 cam.location=(4,0,.85) if side else (0,-4,.85);aim(cam,(0,0,.85))
 scene.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
report={'source':str(source),'sourceTriangles':220097,'runtimeTriangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'runtimeBytes':OUT.stat().st_size,'joints':len(rig.data.bones),'sourceTextures':source_sizes,'runtimeTextureLimit':2048,'sourceRootDriftRemoved':root_start,'clips':['Walk','Idle_Neutral'],'limitations':['Idle is a local neutral breathing fallback; no supplied idle or greeting.','Running is retained in the original ZIP, not used in story walking.','No facial blendshapes; no physical-phone performance validation.']}
(ART/'report.json').write_text(json.dumps(report,indent=2)+'\n');print('RIGGED_REVIEW_COMPLETE',report)
