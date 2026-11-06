CREATE OR REPLACE FUNCTION pg_temp.one_zone(t text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
 pair text[];
BEGIN
 FOREACH pair SLICE 1 IN ARRAY ARRAY[
  ['(나) 구역은 처음과 비슷한 상태를 유지했다. 비교 범위와 관찰 방법은 같게 맞추고,','관찰 범위와 방법은 처음과 같게 맞추고,'],
  [' (나) 구역은 기존 상태를 유지했다.',''],
  ['두 관찰 구역 (가)와 (나)를 비교했다.','한 관찰 구역을 살펴보았다.'],
  ['처음에는 비슷했던 두 곳이, 한 생물의 변화 뒤 다른 모습을 보이기 시작했다.','처음에는 안정되어 있던 이곳이, 한 생물의 변화 뒤 달라지기 시작했다.'],
  ['처음 두 구역의 상태는 비슷했다.','처음에는 안정된 상태였다.'],
  ['두 구역의 벼는 비슷한 높이로 자라고 있었다.','이 구역의 벼는 고른 높이로 자라고 있었다.'],
  ['두 먹이터의 물을 같은 방법으로 살펴보면','이 먹이터의 물을 살펴보면'],
  ['두 바위 해안에는 켈프가 비슷한 상태로 자라고 있었다.','이 바위 해안에는 켈프가 고르게 자라고 있었다.'],
  ['두 초원 구역에는 비슷한 상태의 풀이 자라고 있었다.','이 초원 구역에는 풀이 고르게 자라고 있었다.'],
  ['두 초원 구역은 풀의 상태와 굴 주변의 생물 흔적이 비슷했다.','이 초원 구역에서는 풀과 굴 주변의 생물 흔적이 관찰되었다.'],
  ['두 하천 구역의 돌 표면에는','이 하천 구역의 돌 표면에는'],
  ['두 해초 구역에는 비슷한 상태의 해초가 자라고 있었다.','이 해초 구역에는 해초가 고르게 자라고 있었다.'],
  ['두 화단에는 같은 품종의 장미가 자라고 있었다.','이 화단에는 같은 품종의 장미가 자라고 있었다.'],
  ['벼 잎의 색과 피해 흔적도 두 구역에서 큰 차이가 없었다.','벼 잎의 색과 피해 흔적도 고르게 나타났다.'],
  ['새순의 상태와 곤충의 관찰 기록은 두 화단이 비슷했다.','새순의 상태와 곤충의 관찰 기록을 함께 남겼다.'],
  ['숲 가장자리의 두 구역에는 클로버가 비슷하게 덮여 있었다.','숲 가장자리의 이 구역에는 클로버가 고르게 덮여 있었다.'],
  ['습한 목초지의 두 구역에는','습한 목초지의 이 구역에는'],
  ['처음의 식생 상태에는 큰 차이가 없었다.','처음의 식생은 안정된 상태였다.'],
  ['각 항목의 처음 상태를 각각 100으로 놓았습니다. ',''],
  ['100으로 돌아왔어도 직전 130과 비교하면 감소입니다.','처음 수준으로 돌아왔어도 직전 단계와 비교하면 감소입니다.'],
  ['100으로 돌아왔어도 직전 70과 비교하면 증가입니다.','처음 수준으로 돌아왔어도 직전 단계와 비교하면 증가입니다.'],
  ['각 항목은 자기 자신의 처음 상태를 100으로 표시합니다.',''],
  ['서로 다른 영양단계의 100을 같은 개체수·질량·에너지로 비교할 수 없습니다.','층끼리 양을 비교하는 그림이 아닙니다.'],
  ['비교한 증가·감소·유지 방향으로','비교한 증가, 감소 방향으로'],
  ['처음의 100과 비교하거나 정확한 숫자 크기를 맞추는 문제가 아닙니다.','처음 상태와 비교하거나 크기를 맞추는 문제가 아닙니다.'],
  ['양을 비교했다.','양을 조사했다.'],
  ['다른 구역으로 옮겼다','다른 곳으로 옮겼다'],
  ['(가) 구역에서 (나) 구역보다 더 ','변화 전보다 더 '],
  ['(가) 구역에는 새로 먹힌 흔적이 (나) 구역보다','이 구역에는 새로 먹힌 흔적이 변화 전보다'],
  ['(나) 구역보다','변화 전보다'],
  ['(가) 구역','이 구역'],
  ['(가) 화단','이 화단']
 ] LOOP
  t:=replace(t,pair[1],pair[2]);
 END LOOP;
 RETURN t;
END;
$$;

BEGIN;
UPDATE eco2026.cases SET public_data=pg_temp.one_zone(public_data::text)::jsonb,solution=pg_temp.one_zone(solution::text)::jsonb;
WITH organism_images(label,image) AS (VALUES
 ('성게류','/ecosystem-equilibrium/assets/organisms/sea-urchin.webp'),
 ('켈프류','/ecosystem-equilibrium/assets/organisms/kelp.webp'),
 ('해달','/ecosystem-equilibrium/assets/organisms/sea-otter.webp'),
 ('뱀상어(Tiger shark)','/ecosystem-equilibrium/assets/organisms/tiger-shark.webp'),
 ('푸른바다거북(해초를 먹는 개체)','/ecosystem-equilibrium/assets/organisms/green-turtle.webp'),
 ('해초류(seagrasses)','/ecosystem-equilibrium/assets/organisms/seagrass.webp'),
 ('돌 표면의 조류','/ecosystem-equilibrium/assets/organisms/stream-algae.webp'),
 ('송어류','/ecosystem-equilibrium/assets/organisms/trout.webp'),
 ('조류를 먹는 하루살이 유충','/ecosystem-equilibrium/assets/organisms/mayfly-larva.webp'),
 ('동부솜꼬리토끼','/ecosystem-equilibrium/assets/organisms/cottontail.webp'),
 ('붉은여우','/ecosystem-equilibrium/assets/organisms/red-fox.webp'),
 ('클로버류','/ecosystem-equilibrium/assets/organisms/clover.webp'),
 ('엘크','/ecosystem-equilibrium/assets/organisms/elk.webp'),
 ('초원 벼과식물','/ecosystem-equilibrium/assets/organisms/steppe-grass.webp'),
 ('회색늑대','/ecosystem-equilibrium/assets/organisms/gray-wolf.webp'),
 ('검은꼬리프레리도그','/ecosystem-equilibrium/assets/organisms/prairie-dog.webp'),
 ('아메리카오소리','/ecosystem-equilibrium/assets/organisms/badger.webp'),
 ('초원 풀','/ecosystem-equilibrium/assets/organisms/prairie-grass.webp'),
 ('논의 늑대거미','/ecosystem-equilibrium/assets/organisms/wolf-spider.webp'),
 ('벼','/ecosystem-equilibrium/assets/organisms/rice.webp'),
 ('벼멸구','/ecosystem-equilibrium/assets/organisms/planthopper.webp'),
 ('장미','/ecosystem-equilibrium/assets/organisms/rose.webp'),
 ('장미 진딧물','/ecosystem-equilibrium/assets/organisms/aphid.webp'),
 ('진딧물 포식 무당벌레','/ecosystem-equilibrium/assets/organisms/ladybeetle.webp'),
 ('들쥐(Meadow vole)','/ecosystem-equilibrium/assets/organisms/vole.webp'),
 ('쇠부엉이','/ecosystem-equilibrium/assets/organisms/short-eared-owl.webp'),
 ('큰조아재비','/ecosystem-equilibrium/assets/organisms/timothy-grass.webp'),
 ('대왕고래(남극 개체군)','/ecosystem-equilibrium/assets/organisms/bluewhale.webp'),
 ('남극크릴','/ecosystem-equilibrium/assets/organisms/krill.webp'),
 ('식물플랑크톤','/ecosystem-equilibrium/assets/organisms/phytoplankton.webp'))
UPDATE eco2026.cases c SET public_data=jsonb_set(public_data,'{organisms}',(
 SELECT jsonb_agg(o||jsonb_build_object('image',(SELECT image FROM organism_images i WHERE i.label=o->>'label')) ORDER BY n)
 FROM jsonb_array_elements(public_data->'organisms') WITH ORDINALITY AS t(o,n)));
COMMIT;
