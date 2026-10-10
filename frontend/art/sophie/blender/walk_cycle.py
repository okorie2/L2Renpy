"""Sagittal two-bone walk solver for Sophie, facing Blender -Y.
Positive X knee rotation folds the heel backwards (+Y), with the knee forward.
The foot follows a ground-level stance path and a raised return path. Angles are
baked into the existing clip contract; no runtime IK or remote service is needed.
"""
import math
TAU=math.tau
THIGH=.485
SHIN=.460
HIP_Z=1.045
ANKLE_Z=.100
HALF_STRIDE=.300  # .6 m per step, matching the runtime's 1.2 m full cycle.

def smooth(a,b,value):
 t=max(0.,min(1.,(value-a)/(b-a)))
 return t*t*(3.-2.*t)

def leg_weights(z,suffix):
 """Localize the bend around the knee; shoes follow the foot rigidly."""
 hip=smooth(1.00,1.14,z)
 thigh=smooth(.475,.645,z)
 shin=smooth(.10,.22,z)
 return {name:weight for name,weight in {
  'Hips':hip,
  'UpperLeg.'+suffix:(1-hip)*thigh,
  'LowerLeg.'+suffix:(1-hip)*(1-thigh)*shin,
  'Foot.'+suffix:(1-hip)*(1-thigh)*(1-shin),
 }.items() if weight>1e-8}

def walk_pose(phase,side=0):
 """phase in radians; side=0 left, 1 right. Includes testable foot targets."""
 phase=phase%TAU
 body_z=-.031-.025*math.cos(phase*2)
 cycle=(phase/TAU+side*.5)%1.
 swing=cycle>=.5
 t=(cycle-.5)*2 if swing else cycle*2
 lift=.150*math.sin(math.pi*t)**2 if swing else 0.
 if swing:
  # Hermite endpoints share the stance path's velocity; no reversal snap.
  h=3*t*t-2*t*t*t
  y=HALF_STRIDE*(1-2*h)+2*HALF_STRIDE*(2*t*t*t-3*t*t+t)
 else:y=HALF_STRIDE*(2*t-1)
 down=HIP_Z+body_z-(ANKLE_Z+lift)
 distance=math.hypot(y,down)
 assert abs(THIGH-SHIN)<distance<THIGH+SHIN, 'Foot target outside leg reach'
 knee=math.acos(max(-1.,min(1.,(distance*distance-THIGH*THIGH-SHIN*SHIN)/(2*THIGH*SHIN))))
 hip=math.atan2(y,down)-math.atan2(SHIN*math.sin(knee),THIGH+SHIN*math.cos(knee))
 foot_pitch=-.12*math.sin(math.pi*t)**2 if swing else 0.
 return {'hip':hip,'knee':knee,'ankle':foot_pitch-hip-knee,'body_z':body_z,
         'foot_y':y,'foot_z':ANKLE_Z+lift,'swing':swing}
