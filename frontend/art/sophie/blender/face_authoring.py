"""Editable geometric anime face, authored in Blender bind coordinates (Z-up).
No image decal: face, eye layers and expression shapes are mesh geometry.
"""
import math
import bpy
from mathutils import Vector

def build_face(mesh, sphere, tube, material, fixed):
 skin=material('Sophie_FaceSkin','efc1a5')
 sclera=material('Sophie_EyeWhite','fff5e9')
 lash=material('Sophie_Lash','443029')
 iris=material('Sophie_Iris','835333')
 irislight=material('Sophie_IrisLight','b98a58')
 pupil=material('Sophie_Pupil','30241f')
 shine=material('Sophie_EyeShine','fffdf7')
 lip=material('Sophie_Lip','b97565')
 mouthmat=material('Sophie_Mouth','78483f')
 # Width/front/back of horizontal head sections; interpolate and sample smoothly.
 sections=[(1.549,.003,.064,.04),(1.563,.029,.089,.052),(1.588,.054,.102,.068),
  (1.618,.073,.112,.080),(1.648,.086,.115,.088),(1.680,.094,.114,.092),
  (1.714,.096,.112,.096),(1.747,.091,.105,.095),(1.778,.075,.089,.081),
  (1.801,.048,.064,.061),(1.813,.003,.012,.012)]
 cy=-.025
 def section(z):
  for i,(lo,hi) in enumerate(zip(sections,sections[1:])):
   if z<=hi[0]:
    t=max(0,min(1,(z-lo[0])/(hi[0]-lo[0])))
    before=sections[max(0,i-1)]; after=sections[min(len(sections)-1,i+2)]
    return [.5*((2*lo[k])+(-before[k]+hi[k])*t+(2*before[k]-5*lo[k]+4*hi[k]-after[k])*t*t+(-before[k]+3*lo[k]-3*hi[k]+after[k])*t*t*t) for k in range(1,4)]
  return sections[-1][1:]
 def nose(x,z): return .021*math.exp(-(x/.012)**2-((z-1.656)/.021)**2)
 def front(x,z):
  width,depth,_=section(z)
  return cy-depth*math.sqrt(max(.001,1-(x/width)**2))-nose(x,z)
 def expression(obj,name,change):
  if not obj.data.shape_keys: obj.shape_key_add(name='Basis')
  key=obj.shape_key_add(name=name); key.value=0
  for v in key.data: v.co=change(v.co.copy())
  return key
 verts=[]; faces=[]; rings=48; sides=64
 for i in range(rings+1):
  z=sections[0][0]+(sections[-1][0]-sections[0][0])*i/rings
  width,depth,back=section(z)
  for j in range(sides):
   a=j*math.tau/sides; c=math.cos(a); x=width*math.sin(a)
   y=cy-(depth if c>=0 else back)*c
   if c>0: y-=nose(x,z)*c**8
   verts.append((x,y,z))
 for i in range(rings):
  for j in range(sides):
   a=i*sides+j; b=i*sides+(j+1)%sides; faces.append((a,b,b+sides,a+sides))
 faces.extend([tuple(reversed(range(sides))),tuple(rings*sides+j for j in range(sides))])
 head=mesh('Sophie_HeadSkin',verts,faces,skin,fixed('Head'))
 def jaw(co):
  if co.y<-.04 and co.z<1.64:
   w=max(0,1-abs(co.x)/.075)*min(1,(1.64-co.z)/.04)
   co.z-=.004*w
  return co
 expression(head,'jawOpen',jaw)
 # Short neck bridges the preserved sweater neckline to the new chin.
 tube('Sophie_Neck',[(0,-.035,1.505),(0,-.026,1.548),(0,-.020,1.58)],[.036,.034,.037],skin,fixed('Head'),24)
 for sign,suffix in [(1,'L'),(-1,'R')]:
  sphere('Sophie_Ear.'+suffix,(sign*.092,-.01,1.667),(.014,.014,.026),skin,'Head',20,12)
  cx=sign*.045; cz=1.693
  # Layered almond eyes follow the curved facial surface at every vertex.
  def disk(name,rx,top,bottom,mat,depth,cx=cx,cz=cz,round_shape=False):
   vs=[(cx,front(cx,cz)-depth,cz)]; fs=[]; rings=4; segments=40
   for i in range(1,rings+1):
    r=i/rings
    for j in range(segments):
     a=j*math.tau/segments; sn=math.sin(a)
     x=cx+rx*r*math.cos(a)
     z=cz+(top if sn>=0 else bottom)*r*sn
     if not round_shape: z+=sign*(x-cx)*.13
     vs.append((x,front(x,z)-depth,z))
   for j in range(segments): fs.append((0,1+j,1+(j+1)%segments))
   for i in range(rings-1):
    for j in range(segments):
     a=1+i*segments+j; b=1+i*segments+(j+1)%segments
     fs.append((a,a+segments,b+segments,b))
   o=mesh(name,vs,fs,mat,fixed('Head'))
   # Blink collapses all layers onto the same smiling lid seam. Each layer keeps
   # its tiny depth separation, so no pupil remains exposed below the closed lid.
   def blink(co):
    lid=1.693+sign*(co.x-sign*.045)*.13-.001
    co.z=lid+(co.z-lid)*(.075 if mat==lash else .003)
    co.y=front(co.x,co.z)-(.006 if mat==lash else depth)
    return co
   expression(o,'blink_'+suffix,blink)
   return o
  disk('Sophie_EyeOutline.'+suffix,.029,.013,.009,lash,.0018)
  disk('Sophie_EyeWhite.'+suffix,.027,.011,.007,sclera,.0023)
  disk('Sophie_Iris.'+suffix,.0098,.0098,.0072,iris,.0028,round_shape=True)
  # Warm lower iris crescent, darker central pupil and two small catchlights.
  disk('Sophie_IrisLight.'+suffix,.008,.004,.004,irislight,.0031,cz=cz-.003,round_shape=True)
  disk('Sophie_Pupil.'+suffix,.0045,.0075,.005,pupil,.0035,round_shape=True)
  disk('Sophie_Catchlight.'+suffix,.0026,.0026,.0026,shine,.004,cx=cx-sign*.0025,cz=cz+.004,round_shape=True)
  disk('Sophie_CatchlightSmall.'+suffix,.0011,.0011,.0011,shine,.004,cx=cx+sign*.004,cz=cz-.003,round_shape=True)
  # Outer lash flick, kept short so it reads as friendly rather than theatrical.
  x=cx+sign*.026
  tube('Sophie_LashFlick.'+suffix,[(x,front(x,cz+.004)-.003,cz+.004),(x+sign*.006,front(x+sign*.006,cz+.008)-.002,cz+.008)],[.0016,.0002],lash,fixed('Head'),8)
  points=[]
  for i in range(9):
   t=i/8; x=sign*(.018+.055*t); z=1.72+.007*math.sin(t*math.pi)-.002*t
   points.append((x,front(x,z)-.002,z))
  tube('Sophie_Brow.'+suffix,points,[.001,.0018,.0021,.0022,.0022,.002,.0016,.001,.0003],lash,fixed('Head'),8)
 # Lips form a subtle resting smile. Mouth opening is a stored morph, not a
 # runtime landmark guess; outline and cavity deform together.
 def mouth_patch(name,width,height,mat,depth,openheight):
  vs=[(0,front(0,1.614)-depth,1.614)]; fs=[]; sides=48
  for i in range(sides):
   a=i*math.tau/sides; x=width*math.cos(a)
   z=1.614+height*math.sin(a)+.0025*(abs(x)/width)**2
   vs.append((x,front(x,z)-depth,z))
  for i in range(sides): fs.append((0,i+1,(i+1)%sides+1))
  o=mesh(name,vs,fs,mat,fixed('Head'))
  key=o.shape_key_add(name='Basis'); key=o.shape_key_add(name='jawOpen'); key.value=0
  for i,v in enumerate(key.data):
   if i==0: z=1.611
   else:
    a=(i-1)*math.tau/sides
    z=1.611+openheight*math.sin(a)+.0025*(abs(v.co.x)/width)**2
   v.co.z=z; v.co.y=front(v.co.x,z)-depth
  def smile(co):
   co.z+=.003*(abs(co.x)/width)**2
   co.y=front(co.x,co.z)-depth
   return co
  expression(o,'smile',smile)
  return o
 mouth_patch('Sophie_Lips',.019,.0018,lip,.0018,.006)
 mouth_patch('Sophie_Mouth',.0175,.00065,mouthmat,.0024,.0045)
 return head
