# Sophie — Hunyuan3D test pack

For Replicate: https://replicate.com/tencent/hunyuan-3d-3.1

## Image-to-3D test (recommended)

Upload sophie-front.png into image. Leave prompt empty. This endpoint takes image
OR prompt, not both. Do not upload the three images as a collage: the documented
schema has one image input. The side/back images are optional visual references
for evaluating output, Blender cleanup, or a different multi-view endpoint.

Suggested first test: generate_type Normal (textured), face_count 40000, and
enable_pbr false for the initial diffuse-colour/toon experiment. These are test
choices, not guarantees of likeness, topology, mobile performance or lower cost.
The reviewed schema allows 40,000–1,500,000 faces and images up to 6 MB.

Schema checked 10 October 2026:
https://replicate.com/tencent/hunyuan-3d-3.1/versions/a2838628b41a2e0ee2eb19b3ea98a40d75f8d7639bf5a1ddd37ea299bb334854/api

## Text-only comparison

Use hunyuan-text-prompt.txt, with image empty. This describes Sophie but does not
condition on her image, so likeness may differ. It is under the 1,024-character
prompt limit documented by this endpoint.

## References and provenance

All three PNGs were generated using Codex's built-in imagegen, guided by the
original app artwork and the existing inferred turnaround. Exact generation
prompts are saved in front-/side-/back-generation-prompt.txt. Front was generated
first; side and back were generated using it and the turnaround as references.
Original assets were not changed. These are 2D references, not generated meshes.

The side and back are inferred and may differ in pose/detail; they are not a
calibrated multi-view capture. Use the front as the primary identity reference.
For a later rigging pass, check fingers, separation of clothing/hair, the bag
strap, limb weights and facial topology. Generated geometry still needs review.
