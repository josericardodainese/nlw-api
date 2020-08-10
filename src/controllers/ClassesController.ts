import { Request, Response } from 'express';

import db from '../database/connection';
import convertHourToMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
    week_day: number;
    from: string;
    to: string;
}


export default class ClassesController {
    
    async index(request: Request, response: Response) {
        const filters =  request.query;

    
        if(!filters.week_day || !filters.subject || !filters.time) {
            return response.status(400).json({
                error: 'Missing Filters to Search Classes'
            });
        }

        const subject = filters.subject as string;
        const week_day = filters.week_day as string;
        const time = filters.time as string;

        const timeInMinutes = convertHourToMinutes(time);

        const classes = await db('classes')
            .whereExists(function() {
                this.select('class_schedule.*')
                .from('class_schedule')
                .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
                .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
                .whereRaw('`class_schedule`.`from` <= ??', [Number(timeInMinutes)])
                .whereRaw('`class_schedule`.`to` > ??', [Number(timeInMinutes)])
            })
            .where('classes.subject', '=', subject)
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*']);

        response.json(classes);

    }

    async create (request: Request, response: Response){
        const { 
            name, 
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule 
        } =  request.body;
    
        const trx = await db.transaction();
    
        try {
            const inserted_users_ids = await trx('users').insert({
                name, 
                avatar,
                whatsapp,
                bio
            });
        
            const user_id = inserted_users_ids[0];
        
            const inserted_classes_ids = await trx('classes').insert({
                subject,
                cost,
                user_id
            });
        
            const class_id = inserted_classes_ids[0];
        
            const classSchedule = schedule.map((schedule_item: ScheduleItem) => {
                return {
                    class_id,
                    week_day: schedule_item.week_day,
                    from: convertHourToMinutes(schedule_item.from),
                    to: convertHourToMinutes(schedule_item.to)
                }
            });
        
            await trx('class_schedule').insert(classSchedule);
        
            await trx.commit();
        
            return response.status(201).send();
    
        } catch (error) {
            await trx.rollback();
            return response.status(400).json({
                error: 'Unexpected Error While Creating a New Class'
            });
        }
    }
}