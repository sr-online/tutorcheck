// การตั้งค่า Firebase ของโปรเจกต์ (Firestore ใช้เก็บข้อมูลการลงชื่อ)
// ไม่ได้ใช้ระบบล็อกอิน (Firebase Authentication) เพราะข้อมูลที่เก็บไม่จำเป็นต้องมีความปลอดภัยสูง
// ใช้ Firebase SDK แบบ compat (global script) แทน ES module เพื่อให้เปิดไฟล์ index.html/dashboard.html
// แบบดับเบิลคลิกได้โดยตรง ไม่ต้องรันผ่านเว็บเซิร์ฟเวอร์ในเครื่อง
const firebaseConfig = {
  apiKey: "AIzaSyCw_6bCyWYgCBFtpw1kKrRv5j4ndnX73PA",
  authDomain: "check-in-7989c.firebaseapp.com",
  projectId: "check-in-7989c",
  storageBucket: "check-in-7989c.firebasestorage.app",
  messagingSenderId: "788248288651",
  appId: "1:788248288651:web:c729ebb161e168bb9ce38e",
  measurementId: "G-8VRJ9MZVS6",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
