/**
 * usePersonas Hook - Real-time Firestore Updates
 * 
 * Manages real-time synchronization of personas from Firestore
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Persona } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

export function usePersonas() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPersonas([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to personas with error recovery
    const personasRef = collection(firestore, `users/${user.uid}/personas`);
    const personasQuery = query(personasRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      personasQuery,
      {
        includeMetadataChanges: false,
      },
      (snapshot) => {
        try {
          const personasData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || '',
              personality: data.personality || '',
              description: data.description || '',
              dialogExamples: data.dialogExamples || undefined,
              firstMessage: data.firstMessage || undefined,
              alwaysDo: data.alwaysDo || undefined,
              neverDo: data.neverDo || undefined,
              isPinned: data.isPinned ?? false,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Persona;
          });

          // Sort: pinned first, then by creation date (newest first)
          personasData.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });

          setPersonas(personasData);
          setLoading(false);
          setError(null);
        } catch (err) {
          console.error('Error processing personas:', err);
          setLoading(false);
        }
      },
      (err) => {
        // Handle Firestore errors
        if (err.code !== 'unavailable' && !err.message.includes('connection')) {
          setError('Erro ao carregar personas');
        }
        setLoading(false);
      }
    );

    // Cleanup subscription
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        // Ignore errors during cleanup
      }
    };
  }, [user]);

  return {
    personas,
    loading,
    error,
  };
}
