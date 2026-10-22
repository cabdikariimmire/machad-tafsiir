/**
 * Centralized Error Handling Middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('[API Error]:', {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method
  });

  // Handle MySQL duplicate key error (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return res.status(409).json({
      success: false,
      error: 'Diiwaan hore u jiray (Duplicate entry). Fadlan hubi xogta aad gelisay.',
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Handle MySQL foreign key constraint failure
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    return res.status(400).json({
      success: false,
      error: 'Xogta ku xiran lama helin (Invalid reference).',
      code: 'FOREIGN_KEY_FAILURE'
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV !== 'development'
    ? 'Khalad ayaa ka dhacay gudaha server-ka (Internal Server Error).'
    : err.message || 'Khalad aan la garaneyn ayaa dhacay.';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'SERVER_ERROR'
  });
}

/**
 * 404 Route Not Found Middleware
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Waddada la raadiyay (${req.method} ${req.originalUrl}) lama helin.`,
    code: 'NOT_FOUND'
  });
}
