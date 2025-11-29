/**
 * Script de Recuperação de Mensagens
 * 
 * Use este script no console do navegador para verificar mensagens no Firebase Storage
 * e comparar com o que está sendo exibido na tela.
 */

// Cole este código no console do navegador (F12)
async function recoverMessages() {
  try {
    // Pegar user e chatId atual
    const user = (window as any).__user; // Ajustar conforme sua implementação
    const currentChatId = (window as any).__currentChatId; // Ajustar conforme sua implementação
    
    if (!user || !currentChatId) {
      console.error('❌ Usuário ou chat não identificados. Execute dentro do dashboard.');
      return;
    }
    
    console.log('🔍 Buscando mensagens do Firebase Storage...');
    console.log('User ID:', user.uid);
    console.log('Chat ID:', currentChatId);
    
    // Importar função de carregamento direto do Storage
    const { loadMessagesFromStorage } = await import('@/lib/services/message-service');
    
    // Carregar mensagens diretamente do Storage (bypass cache)
    const storageMessages = await loadMessagesFromStorage(user.uid, currentChatId);
    
    console.log('✅ Mensagens encontradas no Storage:', storageMessages.length);
    console.log('📋 Mensagens:', storageMessages);
    
    // Verificar mensagens na UI
    const uiMessages = (window as any).__currentMessages || [];
    console.log('🖥️ Mensagens na UI:', uiMessages.length);
    
    // Comparar
    if (storageMessages.length > uiMessages.length) {
      console.warn('⚠️ ATENÇÃO: Storage tem mais mensagens que a UI!');
      console.warn(`Storage: ${storageMessages.length} | UI: ${uiMessages.length}`);
      console.warn('Diferença:', storageMessages.length - uiMessages.length, 'mensagens');
      
      // Mostrar mensagens faltando
      const uiIds = new Set(uiMessages.map((m: any) => m.id));
      const missing = storageMessages.filter(m => !uiIds.has(m.id));
      console.log('🔴 Mensagens faltando na UI:', missing);
    } else if (storageMessages.length === uiMessages.length) {
      console.log('✅ Storage e UI sincronizados!');
    } else {
      console.warn('⚠️ UI tem mais mensagens que Storage (pode estar desatualizado)');
    }
    
    return storageMessages;
  } catch (error) {
    console.error('❌ Erro ao recuperar mensagens:', error);
    throw error;
  }
}

// Executar
recoverMessages();
