from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

# Importo las conexiones, modelos y seguridad que ya creamos antes.
from app.database import get_db
from app import models, schemas
from app.security import hash_password, verify_password, create_access_token

# Creeamos el router. Le dice a FastAPI que todas las rutas de aca dentro arrancan con /auth.
router = APIRouter(prefix="/auth", tags=["Autenticación"])

# RUTA DE REGISTRO.
@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    
    # Verifico si el email ya existe.
    emial_existe = db.query(models.User).filter(models.User.email == user.email).first()
    if emial_existe: 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electronico ya está registrado."
        )
    
    # Verifico si el username ya existe.
    username_existe = db.query(models.User).filter(models.User.username == user.username).first()
    if username_existe:
        raise HTTPException(
            status_code= status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario ya está en uso."
        )
    
    # Encriptar la contraseña.
    contraseña_segura = hash_password(user.password)

    # Creo el usuario en la base de datos.
    nuevo_usuario = models.User(
        username= user.username,
        email= user.email,
        hashed_password= contraseña_segura
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    return nuevo_usuario


# RUTA DE LOGIN
@router.post("/login")
def login_user(user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Busco al usuario, por su email.
    usuario = db.query(models.User).filter(models.User.email == user_credentials.username).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Credenciales Inválidas"            
        )
    
    # Verificar Contraseña.
    if not verify_password(user_credentials.password, usuario.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Credenciales Inválidas"
        )
    
    # Si la contraseña es correcta, fabricamos el pase VIP metiendo el username del usuario.
    access_token = create_access_token(data={"sub": usuario.username})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": usuario.username
    }


    