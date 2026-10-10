import math, unittest
from walk_cycle import walk_pose, leg_weights, THIGH, SHIN, HIP_Z

class WalkCycleTests(unittest.TestCase):
 def test_every_sample_reaches_the_foot_target_and_bends_forward(self):
  for i in range(401):
   for side in [0,1]:
    p=walk_pose(i/400*math.tau,side)
    self.assertGreater(p['knee'],0)
    self.assertLess(p['knee'],math.radians(100))
    y=THIGH*math.sin(p['hip'])+SHIN*math.sin(p['hip']+p['knee'])
    z=HIP_Z+p['body_z']-THIGH*math.cos(p['hip'])-SHIN*math.cos(p['hip']+p['knee'])
    self.assertAlmostEqual(y,p['foot_y'],places=8)
    self.assertAlmostEqual(z,p['foot_z'],places=8)
    if not p['swing']:
     self.assertAlmostEqual(z,.1,places=8)
     self.assertAlmostEqual(p['hip']+p['knee']+p['ankle'],0,places=8)
 def test_swing_visibly_folds_the_knee_and_clears_the_ground(self):
  p=walk_pose(math.tau*.75)
  self.assertGreater(p['knee'],math.radians(60))
  self.assertAlmostEqual(p['foot_z'],.25)
 def test_loop_and_left_right_symmetry(self):
  self.assertEqual(walk_pose(0),walk_pose(math.tau))
  for i in range(41):
   a=walk_pose(i/40*math.tau,1);b=walk_pose(i/40*math.tau+math.pi,0)
   for key in ['hip','knee','ankle','body_z','foot_y','foot_z']:self.assertAlmostEqual(a[key],b[key],places=7)
 def test_knee_and_foot_weights_are_local_and_normalized(self):
  for i in range(200):
   weights=leg_weights(i/100,'L')
   self.assertAlmostEqual(sum(weights.values()),1)
   self.assertTrue(all(0<=w<=1 for w in weights.values()))
  self.assertEqual(leg_weights(.05,'L'),{'Foot.L':1})
  self.assertEqual(leg_weights(.75,'L'),{'UpperLeg.L':1})
  self.assertEqual(leg_weights(.30,'L'),{'LowerLeg.L':1})
  self.assertAlmostEqual(leg_weights(.56,'L')['UpperLeg.L'],.5)

if __name__=='__main__':unittest.main()
