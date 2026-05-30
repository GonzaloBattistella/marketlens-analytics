from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Definimos la URL de la base de datos (La dirección de la casa)
# Formato: postgresql://usuario:contraseña@servidor:puerto/nombre_base_datos
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/marketlens_db"

# 2. Creamos el "Motor" (Engine)
# Es el encargado de administrar las conexiones reales y hablar en binario con Postgres
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Creamos la fábrica de "Sesiones" (SessionLocal)
# Cada vez que un usuario haga una consulta a nuestra API, abriremos una sesión.
# Pensalo como una "transacción" o un turno en el banco para operar en la base de datos.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Creamos la Clase Base para nuestros modelos
# Esta clase es mágica: todas las tablas que creemos en el futuro (usuarios, precios, activos)
# van a heredar de esta 'Base'. Así SQLAlchemy sabe que son tablas de la DB y no clases comunes.
Base = declarative_base()

# 5. Función auxiliar para obtener la base de datos (Inyección de dependencias)
# Esta función abre una sesión con la DB cuando entra una consulta, procesa el código,
# y se asegura de CERRAR la conexión cuando termina, para no saturar a Postgres.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()