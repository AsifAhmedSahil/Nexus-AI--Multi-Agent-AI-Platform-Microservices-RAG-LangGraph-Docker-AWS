import crypto from "crypto"
import {getAuth} from "firebase-admin/auth"
import User from "../models/user.model.js"
import { app } from "../config/firebase.js";
import redis from "../../../shared/redis/redis.js";

export const login = async(req,res) =>{
    try {
        const {token} = req.body
        const decoded = await getAuth(app).verifyIdToken(token)
        let user = await User.findOne({
            firebaseUid:decoded.uid

        })

        if(!user){
            user = await User.create({
                firebaseUid:decoded.uid,
                name:decoded.name,
                email:decoded.email,
                avatar:decoded.picture,
                plan:"free",
                credits:100,
                totalCredits:100,
                planExpiresAt:new Date(Date.now() + 30*24*60*60*1000)


            })
        }

        const sessionId = crypto.randomUUID()

        await redis.set(`session-${sessionId}`,JSON.stringify({
            userId: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt

        }),"EX",7*24*60*60)

        res.cookie("session",sessionId,{
            httpOnly: true,
            secure: true ,
            sameSite: "none",
            maxAge: 7*24*60*60*1000
        })

        return res.status(200).json(user)


    } catch (error) {
        return res.status(500).json({message: `login error ${error}`})
        
    
    }
}

export const logout = async(req,res)=>{
    try {
        const sessionId = req.cookie?.session
        await redis.del(`session-${sessionId}`)

        res.clearCookie("session")
        return res.status(200).json({message:"logout success..."})

    } catch (error) {
        return res.status(500).json({message: `logout error ${error}`})
        
    }
}


export const me = async(req,res)=>{
    try {
        const { userId } = req.query
        const user = await User.findById(userId)

        if(!user){
            return res.status(404).json({message:"User not found"})
        }

        return res.status(200).json(user)
    } catch (error) {
        return res.status(500).json({message: `me error ${error}`})
        
    }
}


export const updateUserPayment = async(req,res)=>{
    try {
        const {plan,credits,userId} = req.body
        const user = await User.findById(userId)

        if(!user){
            return res.status(404).json({message:"User not found"})
        }

        user.plan = plan
        user.credits += credits
        user.totalCredits += credits
        user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt

            }), "EX", 7 * 24 * 60 * 60)
        }

        return res.status(200).json({ success: true })
    } catch (error) {
         return res.status(500).json({message:`Update user payment error ${error}`})
        
    }
}

export const deductCredits  = async(req,res)=>{
    try {
        const {userId,agent} = req.body

        const COST ={
            chat:1,
            search:5,
            coding:10,
            pdf:10,
            ppt:10,
            vision:10
        }

        const user = await User.findById(userId)

        if(!user){
            return res.status(404).json({message:"User not found"})
        }

        const requiredCredits = COST[agent] || 1
        if(user.credits<requiredCredits){
            return res.status(400).json({message:"Not enough credits"})

        }

        user.credits -= requiredCredits

        await user.save()

        const sessionId = await redis.get(`user-session-${user?._id}`)
        if (sessionId) {
            await redis.set(`session-${sessionId}`, JSON.stringify({
                userId: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                plan: user.plan,
                credits: user.credits,
                totalCredits: user.totalCredits,
                planExpiresAt: user.planExpiresAt

            }), "EX", 7 * 24 * 60 * 60)
        }

        return res.status(200).json({ success: true })



    } catch (error) {
         return res.status(500).json({message:`deduct credits error ${error}`})
    }
}