import { useCrew } from '@/data/crew';
import { useSnapshotSync } from '@/data/snapshot';
import { useHandoffSync } from '@/data/handoff';
import { useCameraMeals } from '@/data/cammeals';
import { useTeam } from '@/data/team';

/**
 * Background jobs of a signed-in crew member, mounted once under the tabs (renders nothing):
 *  - reports the astronaut's progress to the flight surgeon console (snapshot),
 *  - delivers queued handoff reports and brings back acknowledgements,
 *  - ticks meals the camera station saw,
 *  - keeps the mission briefing in step with the crew commander's shared mission.
 */
export default function Syncs() {
  const crew = useCrew();
  useSnapshotSync(crew, !crew.synthetic);
  useHandoffSync(!crew.synthetic);
  useCameraMeals(!crew.synthetic);
  useTeam();
  return null;
}
