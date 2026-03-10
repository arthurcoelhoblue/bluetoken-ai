
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, avatar_url, google_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'sub'
  );
  
  -- Primeiro usuário é ADMIN automaticamente
  IF (SELECT COUNT(*) FROM public.profiles) = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'ADMIN');
  ELSE
    -- Default: CLOSER (não mais READONLY)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'CLOSER');
  END IF;
  
  RETURN NEW;
END;
$$;
