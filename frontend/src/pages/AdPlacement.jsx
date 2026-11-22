import { useEffect, useState } from 'react';
import './AdPlacement.css';

function AdPlacement({ placement }) {
  const [advertisement, setAdvertisement] = useState(null);

  useEffect(() => {
    async function fetchAdvertisement() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/advertisements/placement/${encodeURIComponent(placement)}`,
        );

        if (!response.ok) {
          throw new Error('Failed to retrieve advertisement.');
        }

        const data = await response.json();

        setAdvertisement(data.length > 0 ? data[0] : null);
      } catch (error) {
        console.error(error);
      }
    }

    fetchAdvertisement();
  }, [placement]);

  if (!advertisement) {
    return null;
  }

  return (
    <a
      href={advertisement.destinationUrl || '#'}
      target='_blank'
      rel='noopener noreferrer'
    >
      <img
        src={advertisement.imageUrl}
        alt={advertisement.name}
        className='ad-image'
        onLoad={() => console.log('Image loaded!')}
        onError={() => console.log('Image failed to load!')}
      />
    </a>
  );
}

export default AdPlacement;
