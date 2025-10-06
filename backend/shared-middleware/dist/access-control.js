import jwt from "jsonwebtoken";
const { TokenExpiredError } = jwt;
export * from "./express.js";
export async function authenticateJWT(req, res, next) {
  const accessToken = req.cookies?.jwt_access_token;
  if (!accessToken) {
    res.status(401).json({ error: "Unauthorized: No access token provided" });
    return;
  }
  try {
    const accessSecret = process.env.ACCESS_JWT_SECRET;
    if (!accessSecret) {
      throw new Error("ACCESS_JWT_SECRET is not defined");
    }
    const decoded = jwt.verify(accessToken, accessSecret);
    // Add user info to request object
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
    };
    next(); // Proceed to next middleware or route handler
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        error: "Unauthorized: Expired access token",
      });
      return;
    }
    res.status(401).json({
      error: "Unauthorized: Invalid token" + err,
    });
    return;
  }
}
//# sourceMappingURL=access-control.js.map
