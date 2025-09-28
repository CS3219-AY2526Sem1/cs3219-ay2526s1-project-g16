import jwt from "jsonwebtoken";
export * from "./express.js";
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }
  const access_token = authHeader.split(" ")[1];
  if (!access_token) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in the environment variables");
    }
    const decoded = jwt.verify(access_token, secret);
    // Add user info to request object
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
    };
    next(); // Proceed to next middleware or route handler
  } catch {
    res.status(401).json({
      error: "Unauthorized: Invalid or expired token",
    });
    return;
  }
}
//# sourceMappingURL=access-control.js.map
