from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# 1. Tabla de Indicadores en Tiempo Real
class MarketIndicator(Base):
    __tablename__ = "market_indicators"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    precio_actual = Column(Float, nullable=True)
    variacion_porcentual = Column(Float, nullable=True)
    capitalizacion_mercado = Column(Float, nullable=True)
    volumen = Column(Integer, nullable=True)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# 2. Tabla de Historial de Precios (Serie Temporal)
class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(10), nullable=False, index=True)
    fecha = Column(Date, nullable=False)
    precio_apertura = Column(Float, nullable=False)
    precio_maximo = Column(Float, nullable=False)
    precio_minimo = Column(Float, nullable=False)
    precio_cierre = Column(Float, nullable=False)
    volumen = Column(Integer, nullable=False)
    
    # Creamos un índice compuesto para que buscar un ticker en una fecha específica sea ultra rápido
    # Muy útil cuando tengamos miles de filas de historial
    __table_args__ = (
        index_for_ticker_date := None, # Truco visual, se define abajo nativamente si es necesario, pero SQLAlchemy lo maneja en los argumentos
    )


# 3. Tabla de Usuario.
class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False) #Contraseña encriptada.

    # Relacion: Un usuario puede tener muchos favoritos.
    favoritos = relationship("UserFavorite", back_populates="usuario", cascade="all, delete-orphan") # Para que en casa de borrar un usuario, los favoritos tambien se borren, automaticamente.


# 4. Tabla de Favoritos.
class UserFavorite(Base):
    __tablename__ = "usuarios_favoritos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String, index=True, nullable=False)

    # Relacion inversa, para poder hacer consultas faciles, desde python.
    usuario = relationship("User", back_populates="favoritos")

