"""Bind the original optimized Sophie mesh/UV/colour to Meshy's auto-rig.
Retains original colours exactly instead of approximating the rebaked atlas.
"""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'frontend/art/sophie/meshy-rigged-review';OUT=ROOT/'frontend/public/assets/3d/characters/sophie-meshy-rigged.glb'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'frontend/art/sophie/blender/sophie-meshy-autorig.blend'))
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE');donor=next(o for o in scene.objects if o.type=='MESH')
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis.identity()
for mod in donor.modifiers:mod.show_viewport=False;mod.show_render=False
bpy.context.view_layer.update()
before=set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'frontend/public/assets/3d/characters/sophie-meshy.glb'))
imported=set(scene.objects)-before
obj=next(o for o in imported if o.type=='MESH' and len(o.data.vertices)>10000)
oldrig=next(o for o in imported if o.type=='ARMATURE')
oldrig.animation_data_clear()
for b in oldrig.pose.bones:b.matrix_basis.identity()
for mod in list(obj.modifiers):obj.modifiers.remove(mod)
bpy.context.view_layer.update()
world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
bpy.context.view_layer.objects.active=obj
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
def bounds(o):
 points=[o.matrix_world@v.co for v in o.data.vertices]
 return Vector([min(v[i] for v in points) for i in range(3)]),Vector([max(v[i] for v in points) for i in range(3)])
lo,hi=bounds(obj);dlo,dhi=bounds(donor);scale=(dhi.z-dlo.z)/(hi.z-lo.z)
for v in obj.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))*scale+Vector(((dlo.x+dhi.x)/2,(dlo.y+dhi.y)/2,dlo.z))
for group in list(obj.vertex_groups):obj.vertex_groups.remove(group)
# Blender interpolates Meshy's skin weights from the closest donor surface.
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);donor.select_set(True);bpy.context.view_layer.objects.active=donor
bpy.ops.object.data_transfer(data_type='VGROUP_WEIGHTS',use_create=True,vert_mapping='POLYINTERP_NEAREST',layers_select_src='ALL',layers_select_dst='NAME')
assert len(obj.vertex_groups)==23,[(g.name) for g in obj.vertex_groups]
for v in obj.data.vertices:
 total=sum(g.weight for g in v.groups);assert total>.99 and total<1.01,'Unbound original vertex'
world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
mod=obj.modifiers.new('Meshy auto-rig weights','ARMATURE');mod.object=rig
obj.name='Sophie_Original_Appearance_Meshy_Rig'
for o in imported:
 if o!=obj and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.objects.remove(donor,do_unlink=True)
for track in rig.animation_data.nla_tracks:track.mute=track.name!='Idle_Neutral'
scene.frame_set(0);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'frontend/art/sophie/blender/sophie-meshy-original-appearance.blend'))
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_image_format='JPEG',export_jpeg_quality=90,export_materials='EXPORT',export_force_sampling=True)
cam=scene.camera
cam.location=(0,-4,.85);cam.rotation_euler=(Vector((0,0,.85))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.cycles.samples=16;scene.render.resolution_x=600;scene.render.resolution_y=760
for label,clip,frame in [('original-appearance-neutral','Idle_Neutral',0),('original-appearance-walk','Walk',6)]:
 for track in rig.animation_data.nla_tracks:track.mute=track.name!=clip
 scene.frame_set(frame);scene.render.filepath=str(ART/(label+'.png'));bpy.ops.render.render(write_still=True)
report={'appearanceSource':'public/assets/3d/characters/sophie-meshy.glb','rigSource':'Meshy_AI_SophieRigged_biped.zip','vertices':len(obj.data.vertices),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'bytes':OUT.stat().st_size,'joints':len(rig.data.bones),'clips':['Walk','Idle_Neutral'],'method':'Original mesh, UVs and colour atlas; closest-surface interpolation of Meshy skin weights','limitations':['Inspect cloth and bag deformation after weight transfer.','No physical-phone performance validation.']}
(ART/'original-appearance-report.json').write_text(json.dumps(report,indent=2)+'\n');print('ORIGINAL_APPEARANCE_COMPLETE',report,flush=True)
