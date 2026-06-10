from pydantic import BaseModel, EmailStr
from typing import List, Optional

# ==========================================
#           SCHEMAS DE USUARIO
# ==========================================

# 1. Lo que pide el frontend, para registrar un usuario nuevo.
class UserCreate(BaseModel):
    username: str
    email: EmailStr # Valida automaticamente, que el texto sea un mail real.
    password: str


# 2. Lo que devuelve la API cuando consultamos datos de un usuario. 
class UserOut(BaseModel):
    id: int
    username: str
    email: str

    class Config: 
        from_attributes = True # Le permite a Pydantic, leer modelos de SQLAlchemy.



# ==========================================
#   SCHEMAS DE AUTENTICACIÓN (TOKENS JWT)
# ==========================================

# 3. Lo que le devolvemos al frontend cunado el login es exitoso.
class Token(BaseModel):
    acceso_token: str
    token_type: str # Siempre va a ser, "bearer".


# 4. Los datos que viajan adentro del Token encriptado.
class TokenData(BaseModel):
    username: Optional[str] = None


