import http from 'node:http';

const BASE_URL = 'http://localhost:8080';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof Uint8Array)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // raw text
  }

  return { status: res.status, headers: res.headers, text, json, ok: res.ok };
}

async function getDemoToken(role, sub, name) {
  const params = new URLSearchParams({ role });
  if (sub) params.set('sub', sub);
  if (name) params.set('name', name);
  const res = await request(`/demo/token?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to get demo token: ${res.status} ${res.text}`);
  return res.json.accessToken;
}

function generateUuid() {
  return crypto.randomUUID();
}

async function runE2eSuite() {
  console.log('====================================================');
  console.log('   SUITE DE INTEGRACIÓN DE APIS REALES (HTTP/S3)     ');
  console.log('====================================================\n');

  const results = [];

  function pass(name, detail = '') {
    results.push({ name, passed: true, detail });
    console.log(`[PASS] ${name} ${detail ? '(' + detail + ')' : ''}`);
  }

  function fail(name, error) {
    results.push({ name, passed: false, detail: String(error) });
    console.error(`[FAIL] ${name}: ${error}`);
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Inicio de sesión y control de acceso por rol
    // -------------------------------------------------------------------------
    console.log('--- Escenario 1: Autenticación legítima y control de roles ---');
    const ownerToken = await getDemoToken('OWNER', 'auth0|demo-owner', 'Carolina Restrepo Arango');
    const fixerToken = await getDemoToken('FIXER', 'auth0|demo-fixer', 'Jhon Fredy Cárdenas Ospina');

    const ownerMe = await request('/auth/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    if (ownerMe.status === 200 && ownerMe.json.roles.includes('OWNER') && ownerMe.json.status === 'ACTIVE') {
      pass('1.1 Autenticación y rol de Propietario', `ID: ${ownerMe.json.id}, Email: ${ownerMe.json.email}`);
    } else {
      fail('1.1 Autenticación y rol de Propietario', `Status: ${ownerMe.status}`);
    }

    const fixerMe = await request('/auth/me', { headers: { Authorization: `Bearer ${fixerToken}` } });
    if (fixerMe.status === 200 && fixerMe.json.roles.includes('FIXER') && fixerMe.json.status === 'ACTIVE') {
      pass('1.2 Autenticación y rol de Técnico', `ID: ${fixerMe.json.id}, Email: ${fixerMe.json.email}`);
    } else {
      fail('1.2 Autenticación y rol de Técnico', `Status: ${fixerMe.status}`);
    }

    const ownerId = ownerMe.json.id;
    const fixerId = fixerMe.json.id;

    // Obtener propiedad del propietario
    const propsRes = await request('/properties/me', { headers: { Authorization: `Bearer ${ownerToken}` } });
    if (!propsRes.ok || !propsRes.json.length) {
      throw new Error('No se encontraron inmuebles para el propietario');
    }
    const propertyId = propsRes.json[0].id;
    pass('1.3 Consulta de inmuebles asignados al propietario', `PropertyId: ${propertyId}, Total: ${propsRes.json.length}`);

    // -------------------------------------------------------------------------
    // 2. Creación de solicitud digital
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 2: Creación de solicitud digital (100 % digital) ---');
    const createReqRes = await request('/requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: {
        propertyId,
        title: 'Reparación de filtración en baño principal',
        description: 'Tubería rota bajo lavamanos con goteo constante',
        urgencyLevel: 'HIGH',
        paymentMethod: 'TRANSFER',
        mediaIds: []
      }
    });

    const requestId = createReqRes.json?.requestId || createReqRes.json?.id;
    if (createReqRes.status === 201 && requestId) {
      pass('2.1 Creación de solicitud digital en modalidad TRANSFER', `RequestId: ${requestId}, Estado: ${createReqRes.json.status}`);
    } else {
      fail('2.1 Creación de solicitud digital', `Status: ${createReqRes.status}: ${createReqRes.text}`);
    }

    // -------------------------------------------------------------------------
    // 3. Cotización y aceptación
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 3: Cotización por técnico y aceptación por propietario ---');
    const quoteRes = await request('/quotations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: {
        requestId,
        amount: 250000,
        estimatedDays: 2,
        message: 'Incluye cambio de empaque, tubo PVC y sellado.'
      }
    });

    const quotationId = quoteRes.json?.id || quoteRes.json?.quotationId;
    if (quoteRes.status === 201 && quotationId) {
      pass('3.1 Envío de cotización por técnico', `QuotationId: ${quotationId}, Monto: $250.000`);
    } else {
      fail('3.1 Envío de cotización por técnico', `Status: ${quoteRes.status}: ${quoteRes.text}`);
    }

    const acceptRes = await request(`/quotations/${quotationId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });

    const paymentId = acceptRes.json?.paymentId;
    if (acceptRes.status === 200 && paymentId) {
      pass('3.2 Aceptación de cotización genera paymentId sin abrir trabajo prematuramente',
           `PaymentId: ${paymentId}, Método: ${acceptRes.json.paymentMethod}`);
    } else {
      fail('3.2 Aceptación de cotización', `Status: ${acceptRes.status}: ${acceptRes.text}`);
    }

    // Verificar que Job no existe aún para la solicitud antes del pago
    const checkJobBefore = await request(`/jobs/for-request/${requestId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    if (checkJobBefore.status === 404) {
      pass('3.3 Trabajo permanece cerrado antes de la aprobación del pago digital', 'HTTP 404 verificado');
    } else {
      fail('3.3 Trabajo antes de pago', `Esperado 404, recibido ${checkJobBefore.status}`);
    }

    // -------------------------------------------------------------------------
    // 4. Checkout sandbox con resultado rechazado y aprobado
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 4: Pasarela de pagos con intentos rechazados y aprobados ---');
    const paymentDetail = await request(`/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    if (paymentDetail.status === 200 && paymentDetail.json.status === 'PENDING') {
      pass('4.1 Consulta de detalle de pago en estado PENDING', `Monto int64: ${paymentDetail.json.amount}, Referencia: ${paymentDetail.json.reference}`);
    } else {
      fail('4.1 Detalle de pago', `Status: ${paymentDetail.status}`);
    }

    const canonicalRef = paymentDetail.json.reference;
    const canonicalAmount = paymentDetail.json.amount;

    // 4.2 Intento con monto no coincidente -> debe ser rechazado con 409 PAYMENT_AMOUNT_MISMATCH
    const rejectedAttemptRes = await request(`/payments/${paymentId}/attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': generateUuid()
      },
      body: {
        instrument: 'SANDBOX_CARD',
        amount: 100000,
        reference: canonicalRef
      }
    });

    if (rejectedAttemptRes.status === 409 && rejectedAttemptRes.json.code === 'PAYMENT_AMOUNT_MISMATCH') {
      pass('4.2 Intento rechazado por discrepancia de monto en pasarela', `Código: ${rejectedAttemptRes.json.code}`);
    } else {
      fail('4.2 Rechazo por discrepancia de monto', `Esperado 409 PAYMENT_AMOUNT_MISMATCH, recibido: ${rejectedAttemptRes.status}: ${rejectedAttemptRes.text}`);
    }

    // 4.3 Intento válido aprobado
    const attemptKey = generateUuid();
    const attemptRes = await request(`/payments/${paymentId}/attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': attemptKey
      },
      body: {
        instrument: 'SANDBOX_CARD',
        amount: canonicalAmount,
        reference: canonicalRef
      }
    });

    if (attemptRes.status === 200 && attemptRes.json.status === 'APPROVED') {
      pass('4.3 Intento de pago digital aprobado exitosamente', `AttemptId: ${attemptRes.json.attemptId}, TX: ${attemptRes.json.gatewayTransactionId}`);
    } else {
      fail('4.3 Intento de pago digital', `Status: ${attemptRes.status}: ${attemptRes.text}`);
    }

    // -------------------------------------------------------------------------
    // 5. Reintento de operación con la misma clave de idempotencia
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 5: Validación de idempotencia estricta en pasarela ---');
    const retryAttemptRes = await request(`/payments/${paymentId}/attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': attemptKey
      },
      body: {
        instrument: 'SANDBOX_CARD',
        amount: canonicalAmount,
        reference: canonicalRef
      }
    });

    if (retryAttemptRes.status === 200 && retryAttemptRes.json.attemptId === attemptRes.json.attemptId) {
      pass('5.1 Reintento con misma clave de idempotencia devuelve resultado original sin duplicar cargo',
           `Mismo AttemptId: ${retryAttemptRes.json.attemptId}`);
    } else {
      fail('5.1 Idempotencia de reintento', `Status: ${retryAttemptRes.status}: ${retryAttemptRes.text}`);
    }

    // 5.2 Reintento con misma clave pero cuerpo conflictivo -> 409 IDEMPOTENCY_CONFLICT
    const conflictAttemptRes = await request(`/payments/${paymentId}/attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': attemptKey
      },
      body: {
        instrument: 'SANDBOX_NEQUI',
        amount: canonicalAmount,
        reference: canonicalRef
      }
    });

    if (conflictAttemptRes.status === 409 && conflictAttemptRes.json.code === 'IDEMPOTENCY_CONFLICT') {
      pass('5.2 Discrepancia de contenido bajo la misma clave rechazada con HTTP 409 IDEMPOTENCY_CONFLICT', 'Conflicto verificado');
    } else {
      fail('5.2 Conflicto de idempotencia', `Esperado 409 IDEMPOTENCY_CONFLICT, recibido: ${conflictAttemptRes.status}`);
    }

    // 5.3 Intento con nueva clave sobre pago ya aprobado -> 409 PAYMENT_ALREADY_APPROVED
    const alreadyApprovedRes = await request(`/payments/${paymentId}/attempts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': generateUuid()
      },
      body: {
        instrument: 'SANDBOX_CARD',
        amount: canonicalAmount,
        reference: canonicalRef
      }
    });

    if (alreadyApprovedRes.status === 409 && alreadyApprovedRes.json.code === 'PAYMENT_ALREADY_APPROVED') {
      pass('5.3 Intento posterior sobre pago aprobado rechazado con PAYMENT_ALREADY_APPROVED', 'Inmutabilidad financiera validada');
    } else {
      fail('5.3 Pago ya aprobado', `Esperado 409 PAYMENT_ALREADY_APPROVED, recibido: ${alreadyApprovedRes.status}`);
    }

    // 5.4 Verificar estado autoritativo final del pago
    const refreshedPayment = await request(`/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    if (refreshedPayment.status === 200 && refreshedPayment.json.status === 'APPROVED' && refreshedPayment.json.completedAt) {
      pass('5.4 Pago pasa a estado APPROVED autoritativo con fecha de completitud', `CompletedAt: ${refreshedPayment.json.completedAt}`);
    } else {
      fail('5.4 Estado autoritativo de pago', `Status: ${refreshedPayment.json?.status}`);
    }

    // -------------------------------------------------------------------------
    // 6. Apertura del trabajo después de aprobar el pago
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 6: Apertura del trabajo posterior a la aprobación ---');
    const checkJobAfter = await request(`/jobs/for-request/${requestId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const job = checkJobAfter.json?.job || checkJobAfter.json;
    const jobId = job?.id;
    if (checkJobAfter.status === 200 && job?.status === 'ASSIGNED' && jobId) {
      pass('6.1 El trabajo se abre en estado ASSIGNED tras aprobarse el pago', `JobId: ${jobId}`);
    } else {
      fail('6.1 Apertura de trabajo tras pago', `Status: ${checkJobAfter.status}: ${checkJobAfter.text}`);
    }

    // -------------------------------------------------------------------------
    // 7. Programación, inicio, chat activo, evidencias y finalización
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 7: Ciclo de vida del trabajo, evidencias reales en MinIO y cierre digital ---');
    const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
    const scheduleRes = await request(`/jobs/${jobId}/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: { scheduledFor: futureDate }
    });
    if (scheduleRes.status === 200 && scheduleRes.json.status === 'SCHEDULED') {
      pass('7.1 Programación de visita técnica', `ScheduledFor: ${futureDate}`);
    } else {
      fail('7.1 Programación de trabajo', `Status: ${scheduleRes.status}: ${scheduleRes.text}`);
    }

    const startRes = await request(`/jobs/${jobId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: { note: 'Técnico iniciando labor en sitio' }
    });
    if (startRes.status === 200 && startRes.json.status === 'IN_PROGRESS') {
      pass('7.2 Inicio del trabajo por técnico', `Estado: ${startRes.json.status}`);
    } else {
      fail('7.2 Inicio de trabajo', `Status: ${startRes.status}: ${startRes.text}`);
    }

    // Mensajes de chat en trabajo asignado / en curso
    const msgOwnerRes = await request(`/requests/${requestId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { body: 'Hola Jhon Fredy, ¿a qué hora estimas llegar?' }
    });
    if (msgOwnerRes.status === 201) {
      pass('7.3 Propietario envía mensaje en chat activo de trabajo en curso', `MsgId: ${msgOwnerRes.json.id}`);
    } else {
      fail('7.3 Envío de mensaje propietario', `Status: ${msgOwnerRes.status}: ${msgOwnerRes.text}`);
    }

    const msgFixerRes = await request(`/requests/${requestId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: { body: 'En 15 minutos llego al predio con los repuestos.' }
    });
    if (msgFixerRes.status === 201) {
      pass('7.4 Técnico responde en chat activo de trabajo en curso', `MsgId: ${msgFixerRes.json.id}`);
    } else {
      fail('7.4 Envío de mensaje técnico', `Status: ${msgFixerRes.status}: ${msgFixerRes.text}`);
    }

    // Subir evidencia real a MinIO
    // 1x1 JPEG sintético válido
    const dummyJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
      0x00, 0xBF, 0x00, 0xFF, 0xD9
    ]);

    const uploadTicketRes = await request('/media/uploads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: {
        purpose: 'JOB_EVIDENCE',
        contentType: 'image/jpeg',
        sizeBytes: dummyJpeg.length
      }
    });

    if (uploadTicketRes.status === 201 && uploadTicketRes.json?.uploadUrl) {
      pass('7.5 Solicitud de ticket presignado para subida a MinIO', `MediaId: ${uploadTicketRes.json.mediaId}`);

      // Subida binaria directa a MinIO
      const minioUploadRes = await fetch(uploadTicketRes.json.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: dummyJpeg
      });

      if (minioUploadRes.ok) {
        pass('7.6 Transferencia binaria directa exitosa a MinIO S3', `HTTP ${minioUploadRes.status}`);

        // Confirmar carga en backend
        const confirmRes = await request(`/media/uploads/${uploadTicketRes.json.mediaId}/confirm`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${fixerToken}` }
        });

        if (confirmRes.status === 200) {
          pass('7.7 Confirmación de medio verificada por backend contra MinIO', `Status: ${confirmRes.json.status}`);

          // Adjuntar evidencia al trabajo
          const attachEvidenceRes = await request(`/jobs/${jobId}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${fixerToken}` },
            body: {
              stage: 'DURING',
              mediaIds: [uploadTicketRes.json.mediaId],
              caption: 'Evidencia fotográfica de tubería instalada'
            }
          });

          if (attachEvidenceRes.status === 200 || attachEvidenceRes.status === 201) {
            pass('7.8 Evidencia adjuntada al trabajo exitosamente', `Etapa: DURING, Total evidencias: ${attachEvidenceRes.json.length}`);
          } else {
            fail('7.8 Adjuntar evidencia', `Status: ${attachEvidenceRes.status}: ${attachEvidenceRes.text}`);
          }
        } else {
          fail('7.7 Confirmación de medio en backend', `Status: ${confirmRes.status}: ${confirmRes.text}`);
        }
      } else {
        fail('7.6 Transferencia binaria a MinIO', `Status: ${minioUploadRes.status}`);
      }
    } else {
      fail('7.5 Ticket presignado MinIO', `Status: ${uploadTicketRes.status}: ${uploadTicketRes.text}`);
    }

    // Completar trabajo digital (TRANSFER sin receivedAmount)
    const completeRes = await request(`/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixerToken}` },
      body: {
        note: 'Trabajo terminado con éxito. Tubería sellada y probada a presión.'
      }
    });
    if (completeRes.status === 200 && completeRes.json.status === 'COMPLETED') {
      pass('7.9 Finalización de trabajo digital TRANSFER sin receivedAmount', `Estado: ${completeRes.json.status}`);
    } else {
      fail('7.9 Finalización de trabajo', `Status: ${completeRes.status}: ${completeRes.text}`);
    }

    // -------------------------------------------------------------------------
    // 8. Chat en modo solo lectura después del cierre
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 8: Chat de solo lectura tras el cierre ---');
    const messagesRes = await request(`/requests/${requestId}/messages`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    if (messagesRes.status === 200 && Array.isArray(messagesRes.json) && messagesRes.json.length >= 2) {
      pass('8.1 Lectura de historial de mensajes tras cierre', `Total mensajes recuperados: ${messagesRes.json.length}`);
    } else {
      fail('8.1 Lectura de mensajes', `Status: ${messagesRes.status}`);
    }

    const postMsgAfterClose = await request(`/requests/${requestId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: { body: 'Intento de mensaje con solicitud cerrada' }
    });
    if (postMsgAfterClose.status === 409 && postMsgAfterClose.json?.code === 'REQUEST_NOT_ASSIGNED') {
      pass('8.2 Escritura bloqueada con HTTP 409 REQUEST_NOT_ASSIGNED en solicitud cerrada', 'Solo lectura garantizada tras completitud');
    } else {
      fail('8.2 Bloqueo de escritura en chat cerrado', `Esperado 409 REQUEST_NOT_ASSIGNED, recibido: ${postMsgAfterClose.status}: ${postMsgAfterClose.text}`);
    }

    // -------------------------------------------------------------------------
    // 9. Consulta de ingresos y retiro simulado
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 9: Ingresos y retiros simulados de técnico ---');
    const earningsRes = await request('/payments/me/earnings', {
      headers: { Authorization: `Bearer ${fixerToken}` }
    });
    if (earningsRes.status === 200 && earningsRes.json.availableBalance > 0) {
      pass('9.1 Consulta de ingresos del técnico con saldo liberado',
           `Disponible: $${earningsRes.json.availableBalance}, Total: $${earningsRes.json.grossTotal}`);
    } else {
      fail('9.1 Consulta de ingresos', `Status: ${earningsRes.status}: ${earningsRes.text}`);
    }

    const payoutKey = generateUuid();
    const payoutRes = await request('/payments/me/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fixerToken}`,
        'Idempotency-Key': payoutKey
      }
    });
    if (payoutRes.status === 201 && payoutRes.json.status === 'TRANSFERRED') {
      pass('9.2 Solicitud de retiro simulado con Idempotency-Key y sin cuerpo HTTP',
           `PayoutId: ${payoutRes.json.id}, Monto transferido: $${payoutRes.json.amount}`);
    } else {
      fail('9.2 Solicitud de retiro', `Status: ${payoutRes.status}: ${payoutRes.text}`);
    }

    // Reintento idéntico del retiro con misma clave
    const retryPayoutRes = await request('/payments/me/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fixerToken}`,
        'Idempotency-Key': payoutKey
      }
    });
    if (retryPayoutRes.status === 201 && retryPayoutRes.json.id === payoutRes.json.id) {
      pass('9.3 Reintento de retiro con misma clave retorna retiro original sin doble consumo',
           `Mismo PayoutId: ${retryPayoutRes.json.id}`);
    } else {
      fail('9.3 Idempotencia de retiro', `Status: ${retryPayoutRes.status}: ${retryPayoutRes.text}`);
    }

    // -------------------------------------------------------------------------
    // 10. Carga del feed de portafolios
    // -------------------------------------------------------------------------
    console.log('\n--- Escenario 10: Feed público de portafolios de técnicos ---');
    const feedRes = await request('/media/portfolio/feed', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    if (feedRes.status === 200 && Array.isArray(feedRes.json.items) && feedRes.json.items.length > 0) {
      const firstPiece = feedRes.json.items[0];
      const hasPresignedUrl = Boolean(firstPiece.readUrl && firstPiece.readUrl.startsWith('http://localhost:9000'));
      const minioImageRes = await fetch(firstPiece.readUrl);
      if (hasPresignedUrl && minioImageRes.ok) {
        pass('10.1 Feed de portafolios retorna piezas con URLs presignadas activas en MinIO',
             `Total piezas: ${feedRes.json.items.length}, Primera pieza: "${firstPiece.title}", MinIO HTTP 200 verificado`);
      } else {
        fail('10.1 Feed de portafolios', `URL: ${firstPiece.readUrl}, MinIO Status: ${minioImageRes.status}`);
      }
    } else {
      fail('10.1 Feed de portafolios', `Status: ${feedRes.status}: ${feedRes.text}`);
    }

  } catch (err) {
    console.error('Error general durante la ejecución E2E:', err);
  }

  console.log('\n====================================================');
  console.log('              RESUMEN DE PRUEBAS E2E                 ');
  console.log('====================================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Pruebas ejecutadas: ${total}`);
  console.log(`Pruebas aprobadas:  ${passed}`);
  console.log(`Pruebas fallidas:   ${total - passed}`);
  console.log('====================================================\n');

  if (passed !== total || total === 0) {
    process.exit(1);
  }
}

runE2eSuite();
