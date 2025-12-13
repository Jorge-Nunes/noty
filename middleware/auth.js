const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado. Token não fornecido.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou usuário inativo.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado.'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Token inválido.'
    });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Permissões insuficientes.'
    });
  }
  next();
};

const operatorMiddleware = (req, res, next) => {
  if (!['admin', 'operator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Permissões insuficientes.'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  operatorMiddleware
};