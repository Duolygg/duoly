import Teammate from '../design-reference/components/Teammate.jsx';
import { SAMPLE_TEAMMATE, SAMPLE_ACCESS } from './sample-data';

export default function TeammatePreview() {
  return (
    <Teammate
      user={SAMPLE_TEAMMATE}
      access={SAMPLE_ACCESS}
      discordLinked={true}
      preview={true}
    />
  );
}
